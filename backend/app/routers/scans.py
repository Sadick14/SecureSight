from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
import os
import json
from typing import Dict, Optional, List, Tuple
from datetime import datetime
from app.models.schemas import ScanRequest, GitHubUser
from app.dependencies import get_current_user
from supabase import create_client, Client
import shutil
import subprocess
import glob
from pathlib import Path
import requests
import uuid
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64

router = APIRouter()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

SNYK_API_URL = "https://api.snyk.io/v1"
SNYK_ORG_ID = os.getenv("SNYK_ORG_ID")

def generate_severity_chart(findings: List[dict], tool_name: str) -> Optional[str]:
    """Generate a severity distribution chart and return as base64 encoded image"""
    if not findings:
        return None
    
    try:
        # Create DataFrame from findings
        df = pd.DataFrame(findings)
        
        # Normalize severity levels
        df['severity'] = df['severity'].str.lower().replace({
            'critical': 'Critical',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low',
            'warning': 'Warning',
            'info': 'Info'
        })
        
        # Count severities
        severity_counts = df['severity'].value_counts().reindex(
            ['Critical', 'High', 'Medium', 'Low', 'Warning', 'Info'], fill_value=0)
        
        # Create plot
        plt.figure(figsize=(8, 4))
        sns.set_style("whitegrid")
        ax = sns.barplot(
            x=severity_counts.index,
            y=severity_counts.values,
            palette="RdYlGn_r",
            saturation=0.8
        )
        
        plt.title(f'{tool_name} - Findings by Severity', fontsize=12)
        plt.xlabel('Severity Level', fontsize=10)
        plt.ylabel('Count', fontsize=10)
        plt.xticks(rotation=45)
        
        # Add value labels
        for p in ax.patches:
            ax.annotate(
                f'{int(p.get_height())}',
                (p.get_x() + p.get_width() / 2., p.get_height()),
                ha='center', va='center',
                xytext=(0, 5),
                textcoords='offset points'
            )
        
        # Save to buffer
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Error generating chart: {e}")
        return None

def generate_file_type_chart(findings: List[dict], tool_name: str) -> Optional[str]:
    """Generate a file type distribution chart"""
    if not findings:
        return None
    
    try:
        df = pd.DataFrame(findings)
        df['file_type'] = df['path'].apply(
            lambda x: Path(x).suffix.lower() if x and isinstance(x, str) else 'unknown')
        
        file_counts = df['file_type'].value_counts().head(10)
        
        plt.figure(figsize=(10, 5))
        sns.set_style("whitegrid")
        ax = sns.barplot(
            x=file_counts.index,
            y=file_counts.values,
            palette="Blues_d",
            saturation=0.8
        )
        
        plt.title(f'{tool_name} - Findings by File Type', fontsize=12)
        plt.xlabel('File Type', fontsize=10)
        plt.ylabel('Count', fontsize=10)
        plt.xticks(rotation=45)
        
        for p in ax.patches:
            ax.annotate(
                f'{int(p.get_height())}',
                (p.get_x() + p.get_width() / 2., p.get_height()),
                ha='center', va='center',
                xytext=(0, 5),
                textcoords='offset points'
            )
        
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Error generating file type chart: {e}")
        return None

def generate_timeline_chart(findings: List[dict], tool_name: str) -> Optional[str]:
    """Generate a timeline of findings"""
    if not findings:
        return None
    
    try:
        df = pd.DataFrame(findings)
        
        # Extract dates if available (for tools that provide discovery dates)
        if 'created_at' in df.columns:
            df['date'] = pd.to_datetime(df['created_at']).dt.date
        else:
            # Fallback to current date for tools without timestamps
            df['date'] = datetime.now().date()
        
        timeline = df.groupby('date').size().reset_index(name='counts')
        
        plt.figure(figsize=(10, 4))
        sns.set_style("whitegrid")
        ax = sns.lineplot(
            x='date',
            y='counts',
            data=timeline,
            marker='o',
            color='#4c72b0',
            linewidth=2.5
        )
        
        plt.title(f'{tool_name} - Findings Over Time', fontsize=12)
        plt.xlabel('Date', fontsize=10)
        plt.ylabel('Findings Count', fontsize=10)
        plt.xticks(rotation=45)
        
        # Highlight max point
        max_idx = timeline['counts'].idxmax()
        ax.scatter(
            x=timeline.loc[max_idx, 'date'],
            y=timeline.loc[max_idx, 'counts'],
            color='red',
            s=100,
            zorder=5
        )
        
        buffer = BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Error generating timeline chart: {e}")
        return None

def enrich_findings_data(tool_name: str, raw_findings: dict) -> dict:
    """Enhance raw findings with additional metadata and visualizations"""
    if not raw_findings or 'error' in raw_findings:
        return {
            'metadata': {
                'message': raw_findings.get('error', 'No findings data available'),
                'status': 'error' if 'error' in raw_findings else 'empty'
            }
        }
    
    # Normalize findings structure across tools
    findings = []
    if tool_name == 'bandit':
        findings = raw_findings.get('results', [])
        for finding in findings:
            finding['severity'] = finding.get('issue_severity', 'medium').title()
            finding['confidence'] = finding.get('issue_confidence', 'medium').title()
    elif tool_name == 'trivy':
        findings = []
        for result in raw_findings.get('Results', []):
            for vuln in result.get('Vulnerabilities', []):
                findings.append({
                    'title': vuln.get('Title', 'Unknown vulnerability'),
                    'severity': vuln.get('Severity', 'unknown').title(),
                    'path': result.get('Target', ''),
                    'description': vuln.get('Description', ''),
                    'package': vuln.get('PkgName', ''),
                    'installed_version': vuln.get('InstalledVersion', ''),
                    'fixed_version': vuln.get('FixedVersion', ''),
                    'references': vuln.get('References', [])
                })
    elif tool_name == 'snyk-code':
        findings = []
        for file in raw_findings.get('files', []):
            for issue in file.get('issues', []):
                findings.append({
                    'title': issue.get('title', 'Unknown issue'),
                    'severity': issue.get('severity', 'medium').title(),
                    'path': file.get('file', ''),
                    'description': issue.get('message', ''),
                    'start_line': issue.get('lineNumber', None),
                    'end_line': issue.get('lineNumber', None),
                    'cwe': issue.get('cwe', []),
                    'references': issue.get('references', [])
                })
    elif tool_name == 'gitleaks':
        findings = raw_findings.get('Findings', [])
        for finding in findings:
            finding['severity'] = 'High'  # Gitleaks findings are typically high severity
    else:
        findings = raw_findings.get('findings', []) or raw_findings.get('vulnerabilities', []) or []
    
    # Generate visualizations
    severity_chart = generate_severity_chart(findings, tool_name)
    file_type_chart = generate_file_type_chart(findings, tool_name)
    timeline_chart = generate_timeline_chart(findings, tool_name)
    
    # Calculate statistics
    total_findings = len(findings)
    severity_counts = {}
    if findings and 'severity' in findings[0]:
        severity_counts = pd.Series([f['severity'] for f in findings]).value_counts().to_dict()
    
    return {
        'metadata': {
            'tool': tool_name,
            'timestamp': datetime.now().isoformat(),
            'total_findings': total_findings,
            'severity_distribution': severity_counts,
            'status': 'completed',
            'scan_id': str(uuid.uuid4()),
            'visualizations': {
                'severity_distribution': severity_chart,
                'file_type_distribution': file_type_chart,
                'timeline': timeline_chart
            }
        },
        'findings': findings
    }

def check_tool_installed(tool: str, version_cmd: list[str]) -> bool:
    try:
        subprocess.run(
            version_cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def run_tool(cmd: list[str], output_file: Optional[str] = None) -> dict:
    try:
        if output_file:
            with open(output_file, 'w') as f:
                subprocess.run(cmd, check=True, stdout=f)
            with open(output_file) as f:
                return json.load(f)
        else:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        return {"error": str(e), "stderr": e.stderr}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON output"}
    except Exception as e:
        return {"error": str(e)}

async def run_snyk_scan(scan_type: str, target_path: str) -> dict:
    headers = {
        "Authorization": f"token {os.getenv('SNYK_TOKEN')}",
        "Content-Type": "application/json"
    }
    
    try:
        if scan_type == "snyk-oss":
            response = requests.post(
                f"{SNYK_API_URL}/test/dependencies",
                headers=headers,
                json={
                    "org": SNYK_ORG_ID,
                    "path": target_path
                }
            )
        elif scan_type == "snyk-code":
            response = requests.post(
                f"{SNYK_API_URL}/test/sast",
                headers=headers,
                json={
                    "org": SNYK_ORG_ID,
                    "path": target_path,
                    "settings": {
                        "languages": ["python", "javascript", "typescript"]
                    }
                }
            )
        elif scan_type == "snyk-container":
            response = requests.post(
                f"{SNYK_API_URL}/test/container",
                headers=headers,
                json={
                    "org": SNYK_ORG_ID,
                    "path": target_path
                }
            )
        else:
            return {"error": f"Unknown Snyk scan type: {scan_type}"}

        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def cleanup_files():
    paths = ["temp_repo", "bandit_results.json", "pylint_results.json", 
             "trivy_results.json", "safety_results.json", "gitleaks_results.json"]
    for path in paths:
        try:
            if os.path.exists(path):
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
        except Exception as e:
            print(f"[⚠️] Cleanup warning for {path}: {str(e)}")

@router.post("/scan")
async def scan_repository(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    user: GitHubUser = Depends(get_current_user)
):
    print(f"[📥] Scan started for: {request.repo}")
    print(f"[⚙️] Selected scan options: {request.scan_options}")
    cleanup_files()

    # 1️⃣ Build your required_tools dict
    required_tools = {'git': ['git', '--version']}
    TRIVY_OPTS = {'trivy-vuln', 'trivy-config', 'trivy-secrets'}
    if set(request.scan_options) & TRIVY_OPTS:
        required_tools['trivy'] = ['trivy', '--version']
    if 'gitleaks' in request.scan_options:
        required_tools['gitleaks'] = ['gitleaks', 'version']
    if 'bandit' in request.scan_options:
        required_tools['bandit'] = ['bandit', '--version']
    if 'safety' in request.scan_options:
        required_tools['safety'] = ['safety', '--version']
    if 'pylint' in request.scan_options:
        required_tools['pylint'] = ['pylint', '--version']

    missing_tools = [t for t, cmd in required_tools.items()
                     if not check_tool_installed(t, cmd)]
    if missing_tools:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing required tools: {', '.join(missing_tools)}"
        )

    try:
        # Clone repository
        print(f"[⏬] Cloning repository: {request.repo}")
        clone_cmd = ["git", "clone", "--depth", str(request.depth or 100), 
                    request.repo, "temp_repo"]
        if request.branch:
            clone_cmd.extend(["--branch", request.branch])
        
        subprocess.run(clone_cmd, check=True)
        repo_path = Path("temp_repo")

        results: Dict[str, dict] = {}
        
        # Gitleaks
        if 'gitleaks' in request.scan_options:
            print("[🔍] Running Gitleaks…")
            gitleaks_raw = run_tool([
                "gitleaks", "detect",
                "-s", str(repo_path),
                "--report-format", "json",
                "--report-path", "gitleaks_results.json",
                "--no-git"
            ])
            results["gitleaks"] = enrich_findings_data("gitleaks", gitleaks_raw)

        # Bandit
        py_files = list(repo_path.glob("**/*.py"))
        if 'bandit' in request.scan_options and py_files:
            print("[🐍] Running Bandit…")
            bandit_raw = run_tool(
                ["bandit", "-r", str(repo_path), "-f", "json"],
                "bandit_results.json"
            )
            results["bandit"] = enrich_findings_data("bandit", bandit_raw)

        # Pylint
        if 'pylint' in request.scan_options and py_files:
            print("[📝] Running Pylint…")
            pylint_raw = run_tool(
                ["pylint", "--output-format=json", str(repo_path)],
                "pylint_results.json"
            )
            results["pylint"] = enrich_findings_data("pylint", pylint_raw)

        # Safety
        if 'safety' in request.scan_options:
            req_path = repo_path / "requirements.txt"
            if req_path.exists():
                print("[🛡️] Running Safety…")
                safety_raw = run_tool(
                    ["safety", "check", "-r", str(req_path), "--output", "json"],
                    "safety_results.json"
                )
                results["safety"] = enrich_findings_data("safety", safety_raw)
            else:
                results["safety"] = {"metadata": {"message": "No requirements.txt found"}}

        # Trivy
        trivy_checks_map = {
            "trivy-vuln": "vuln",
            "trivy-config": "config",
            "trivy-secrets": "secret"
        }
        trivy_checks = [
            trivy_checks_map[opt]
            for opt in request.scan_options
            if opt in trivy_checks_map
        ]
        if trivy_checks:
            print("[🧪] Running Trivy with checks:", trivy_checks)
            trivy_cmd = [
                "trivy", "fs",
                "--security-checks", ",".join(trivy_checks),
                "--format", "json",
                str(repo_path)
            ]
            trivy_raw = run_tool(trivy_cmd, "trivy_results.json")
            results["trivy"] = enrich_findings_data("trivy", trivy_raw)

        # Snyk scans
        if 'snyk-oss' in request.scan_options:
            print("[🧩] Running Snyk OSS scan…")
            snyk_oss_raw = await run_snyk_scan("snyk-oss", str(repo_path))
            results["snyk-oss"] = enrich_findings_data("snyk-oss", snyk_oss_raw)
        
        if 'snyk-code' in request.scan_options:
            print("[🔎] Running Snyk Code scan…")
            snyk_code_raw = await run_snyk_scan("snyk-code", str(repo_path))
            results["snyk-code"] = enrich_findings_data("snyk-code", snyk_code_raw)
        
        if 'snyk-container' in request.scan_options:
            print("[🐳] Running Snyk Container scan…")
            snyk_container_raw = await run_snyk_scan("snyk-container", str(repo_path))
            results["snyk-container"] = enrich_findings_data("snyk-container", snyk_container_raw)

        # Generate summary report
        summary = generate_summary_report(results)
        results["_summary"] = summary

        background_tasks.add_task(
            store_scan_results,
            request.repo,
            results,
            user.id,
            user.login,
            request.scan_options
        )

        print("[✅] Scans complete.")
        return results

    except HTTPException:
        raise
    except Exception as e:
        print(f"[🔥] Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {e}"
        )
    finally:
        background_tasks.add_task(cleanup_files)

def generate_summary_report(results: dict) -> dict:
    """Generate a comprehensive summary of all scan results"""
    summary = {
        "total_findings": 0,
        "severity_counts": {
            "Critical": 0,
            "High": 0,
            "Medium": 0,
            "Low": 0,
            "Warning": 0,
            "Info": 0
        },
        "tools_executed": [],
        "tools_with_findings": [],
        "files_scanned": set(),
        "dependencies_scanned": 0,
        "scan_duration": None,
        "risk_score": 0
    }
    
    for tool, result in results.items():
        if not result or 'metadata' not in result:
            continue
            
        summary["tools_executed"].append(tool)
        
        if result.get('findings'):
            summary["tools_with_findings"].append(tool)
            summary["total_findings"] += len(result['findings'])
            
            # Count severities
            for finding in result['findings']:
                severity = finding.get('severity', 'unknown').title()
                if severity in summary["severity_counts"]:
                    summary["severity_counts"][severity] += 1
                
                # Track files
                if 'path' in finding and finding['path']:
                    summary["files_scanned"].add(finding['path'])
            
            # Track dependencies if tool is dependency scanner
            if tool in ['snyk-oss', 'trivy-vuln', 'safety']:
                summary["dependencies_scanned"] += result['metadata'].get('dependencies_scanned', 0)
    
    # Calculate risk score (weighted sum of findings)
    summary["risk_score"] = (
        summary["severity_counts"]["Critical"] * 10 +
        summary["severity_counts"]["High"] * 5 +
        summary["severity_counts"]["Medium"] * 3 +
        summary["severity_counts"]["Low"] * 1
    )
    
    # Convert files_scanned set to count
    summary["files_scanned"] = len(summary["files_scanned"])
    
    return summary

def store_scan_results(
    repo: str, 
    results: dict, 
    user_id: int, 
    github_login: str,
    scan_options: List[str]
):
    try:
        # Determine the scan type based on the repo URL
        scan_type = "repository"
        if not repo.startswith(("http://", "https://")):
            scan_type = "upload"
        
        response = supabase.table("scans").insert({
            "repo": repo,
            "results": results,
            "user_id": user_id,
            "github_login": github_login,
            "scan_options": scan_options,
            "status": "completed",
            "summary": results.get("_summary", {}),
            "type": scan_type  # Add this required field
        }).execute()
        print("[📦] Stored scan results in Supabase:", response)
    except Exception as e:
        print(f"[🚨] Failed to store scan results: {str(e)}")
        raise  # Re-raise the exception if you want to handle it upstream