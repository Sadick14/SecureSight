import React, { useEffect, useState, useRef } from 'react';
import { Editor, useMonaco } from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

interface CodeEditorProps {
  projectId: string;
  onClose: () => void;
}

interface FileTreeItem {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: FileTreeItem[];
}

interface Vulnerability {
  filePath: string;
  lineNumber: number;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  suggestion: string;
}

interface CodeSuggestion {
  lineNumber: number;
  suggestion: string;
  replacement?: string;
}

const getLanguage = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'c':
      return 'c';
    case 'cpp':
    case 'cxx':
      return 'cpp';
    case 'cs':
    case 'csharp':
      return 'csharp';
    case 'go':
    case 'golang':
      return 'go';
    case 'rb':
    case 'ruby':
      return 'ruby';
    case 'php':
      return 'php';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
};

const FileIcon = ({ type }: { type: 'file' | 'dir' }) => (
  <span className="mr-2">
    {type === 'dir' ? (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#FFD700" className="inline">
        <path d="M13.66 7.36c.21.22.34.5.34.82v4.82c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h2.18c.32 0 .6.13.82.34l.94.94H12c.55 0 1 .45 1 1v2.18z" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#64B5F6" className="inline">
        <path d="M13 3H7.7c-.4 0-.78.16-1.06.44l-1.7 1.7c-.28.28-.44.66-.44 1.06V13c0 .55.45 1 1 1h7c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zm-1 9H5V5h2v2h5v5z" />
      </svg>
    )}
  </span>
);

const renderFileTree = (items: FileTreeItem[], onFileClick: (path: string) => void, selectedFilePath: string | null) => {
  return (
    <ul className="list-none m-0 p-0">
      {items.map((item) => (
        <li key={item.path} className="m-0">
          <div
            className={`flex items-center cursor-pointer hover:bg-[#2a2d2e] p-1 rounded transition-colors ${
              selectedFilePath === item.path ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30' : ''
            }`}
            onClick={() => item.type === 'file' && onFileClick(item.path)}
          >
            <FileIcon type={item.type} />
            <span className="text-[#E0E0E0] text-sm">{item.name}</span>
          </div>
          {item.children && item.children.length > 0 && (
            <div className="ml-4 border-l-2 border-gray-700">
              {renderFileTree(item.children, onFileClick, selectedFilePath)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

const CodeEditor: React.FC<CodeEditorProps> = ({ projectId, onClose }) => {
  const [fileTreeData, setFileTreeData] = useState<FileTreeItem[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFileTree, setLoadingFileTree] = useState<boolean>(true);
  const [loadingFileContent, setLoadingFileContent] = useState<boolean>(false);
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanningProject, setScanningProject] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string | null>(null);
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const [vulnerabilityDecorations, setVulnerabilityDecorations] = useState<string[]>([]);
  const [suggestionDecorations, setSuggestionDecorations] = useState<string[]>([]);
  const monaco = useMonaco();

  // Fetch the file tree
  useEffect(() => {
    const fetchFileTree = async () => {
      setLoadingFileTree(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/projects/${projectId}/file-tree`);
        if (!response.ok) {
          throw new Error(`Failed to fetch file tree: ${response.statusText}`);
        }
        const treeData: FileTreeItem[] = await response.json();
        setFileTreeData(treeData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingFileTree(false);
      }
    };

    if (projectId) {
      fetchFileTree();
    }
  }, [projectId]);

  // Fetch the content of the selected file
  useEffect(() => {
    const fetchFileContent = async () => {
      if (!selectedFilePath) {
        setFileContent(null);
        setEditorContent(null);
        return;
      }

      setLoadingFileContent(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/projects/${projectId}/files/${encodeURIComponent(selectedFilePath)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch file content: ${response.statusText}`);
        }
        const textContent = await response.text();
        setFileContent(textContent);
        setEditorContent(textContent);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingFileContent(false);
      }
    };

    fetchFileContent();
  }, [projectId, selectedFilePath]);

  const handleFileTreeClick = (filePath: string) => {
    setSelectedFilePath(filePath);
    // Clear existing decorations when a new file is selected
    if (editorRef.current) {
      editorRef.current.deltaDecorations([...vulnerabilityDecorations, ...suggestionDecorations], []);
      setVulnerabilityDecorations([]);
      setSuggestionDecorations([]);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || '');
  };

  const handleEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const saveFile = async () => {
    if (!selectedFilePath || editorContent === null) {
      console.warn("No file selected or editor content is empty.");
      return;
    }

    setSavingFile(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/files/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: selectedFilePath,
          content: editorContent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      console.log("File saved successfully!");
    } catch (err: any) {
      setError(`Error saving file: ${err.message}`);
    } finally {
      setSavingFile(false);
    }
  };

  const applyDecorations = (vulnerabilities: Vulnerability[], suggestions: CodeSuggestion[]) => {
    if (!editorRef.current || !monaco) return;

    // Clear existing decorations
    editorRef.current.deltaDecorations([...vulnerabilityDecorations, ...suggestionDecorations], []);

    // Apply vulnerability decorations
    const newVulnDecorations = vulnerabilities.map((vuln) => ({
      range: new monaco.Range(vuln.lineNumber, 1, vuln.lineNumber, 1000),
      options: {
        isWholeLine: true,
        className: `vulnerability-decoration-${vuln.severity.toLowerCase()}`,
        glyphMarginClassName: `vulnerability-glyph-${vuln.severity.toLowerCase()}`,
        glyphMarginHoverMessage: { value: `${vuln.severity} Vulnerability: ${vuln.description}` },
        hoverMessage: { 
          value: `**${vuln.severity} Severity**\n\n${vuln.description}\n\n**Suggestion:** ${vuln.suggestion}` 
        },
        minimap: {
          position: 1,
          color: vuln.severity === 'High' ? '#FF5252' : vuln.severity === 'Medium' ? '#FFD740' : '#69F0AE',
        },
        overviewRuler: {
          position: 7,
          color: vuln.severity === 'High' ? '#FF5252' : vuln.severity === 'Medium' ? '#FFD740' : '#69F0AE',
        },
      },
    }));

    // Apply suggestion decorations
    const newSuggestionDecorations = suggestions.map((suggestion) => ({
      range: new monaco.Range(suggestion.lineNumber, 1, suggestion.lineNumber, 1000),
      options: {
        isWholeLine: true,
        className: 'suggestion-decoration',
        glyphMarginClassName: 'suggestion-glyph',
        glyphMarginHoverMessage: { value: `Suggestion: ${suggestion.suggestion}` },
        hoverMessage: { 
          value: `**Code Suggestion**\n\n${suggestion.suggestion}${
            suggestion.replacement ? `\n\n**Replacement:**\n${suggestion.replacement}` : ''
          }` 
        },
        minimap: {
          position: 1,
          color: '#64B5F6',
        },
        overviewRuler: {
          position: 7,
          color: '#64B5F6',
        },
      },
    }));

    const allDecorations = [...newVulnDecorations, ...newSuggestionDecorations];
    const decorationIds = editorRef.current.deltaDecorations([], allDecorations);
    
    // Split the decoration IDs back into their types
    setVulnerabilityDecorations(decorationIds.slice(0, vulnerabilities.length));
    setSuggestionDecorations(decorationIds.slice(vulnerabilities.length));
  };

  const analyzeFile = async () => {
    if (!selectedFilePath || editorContent === null) return;

    setScanning(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/projects/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: editorContent,
          filePath: selectedFilePath,
          language: getLanguage(selectedFilePath),
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: { vulnerabilities: Vulnerability[]; suggestions: CodeSuggestion[] } = await response.json();
      applyDecorations(result.vulnerabilities, result.suggestions);
    } catch (err: any) {
      setError(`Error during analysis: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const scanProject = async () => {
    setScanningProject(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Project scan failed: ${response.statusText}`);
      }

      const result: { vulnerabilities: Vulnerability[] } = await response.json();
      
      // If we have a file open, apply decorations for vulnerabilities in this file
      if (selectedFilePath) {
        const fileVulnerabilities = result.vulnerabilities.filter(
          v => v.filePath.endsWith(selectedFilePath)
        );
        applyDecorations(fileVulnerabilities, []);
      }

      // Show summary of all vulnerabilities
      alert(`Project scan complete. Found ${result.vulnerabilities.length} vulnerabilities.`);
    } catch (err: any) {
      setError(`Error during project scan: ${err.message}`);
    } finally {
      setScanningProject(false);
    }
  };

  const language = selectedFilePath ? getLanguage(selectedFilePath) : 'plaintext';

  if (loadingFileTree) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-900 to-gray-800 text-gray-300">
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading project structure...
        </div>
      </div>
    );
  }

  if (error && !loadingFileContent && !savingFile && !scanning && !scanningProject) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="bg-gray-800 p-4 rounded-md border-l-4 border-red-500 max-w-md">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-200">Error</h3>
          </div>
          <div className="mt-2 text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-300 overflow-hidden">
      {/* Activity Bar */}
      <div className="w-12 bg-gray-800 flex flex-col items-center py-2 border-r border-gray-700">
        <button className="p-2 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </button>
        <button className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded mt-2 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
        </button>
        <button className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded mt-2 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-gray-800 flex flex-col border-r border-gray-700">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">EXPLORER</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {fileTreeData.length > 0 ? (
            renderFileTree(fileTreeData, handleFileTreeClick, selectedFilePath)
          ) : (
            <div className="p-4 text-gray-500 text-sm">No files found.</div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Tabs */}
        <div className="bg-gray-800 flex items-center border-b border-gray-700">
          {selectedFilePath && (
            <div className="flex items-center px-3 py-2 border-r border-gray-700 bg-gray-900 text-gray-200">
              <span className="text-xs mr-2 bg-blue-500/20 px-2 py-0.5 rounded text-blue-400">
                {selectedFilePath.split('.').pop()?.toUpperCase()}
              </span>
              <span>{selectedFilePath.split('/').pop()}</span>
              <button className="ml-2 text-gray-500 hover:text-gray-300 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden">
          {loadingFileContent ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading file...
              </div>
            </div>
          ) : selectedFilePath && editorContent !== null ? (
            <Editor
              height="100%"
              language={language}
              value={editorContent}
              theme="vs-dark"
              options={{
                readOnly: false,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 14,
                wordWrap: 'on',
                renderWhitespace: 'selection',
                padding: { top: 10, bottom: 10 },
                glyphMargin: true,
                lineNumbers: 'on',
                folding: true,
                lineDecorationsWidth: 10,
                suggest: {
                  preview: true,
                  showStatusBar: true,
                },
                quickSuggestions: true,
              }}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <p className="mt-4 text-lg">Select a file to view or edit</p>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 text-white text-xs px-4 py-2 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <span className="bg-black/20 px-2 py-1 rounded">
              {selectedFilePath ? language.toUpperCase() : 'NO FILE SELECTED'}
            </span>
            <span className="bg-black/20 px-2 py-1 rounded">
              {selectedFilePath && editorContent ? `${editorContent.split('\n').length} lines` : ''}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={saveFile}
              disabled={!selectedFilePath || savingFile}
              className="flex items-center bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
            >
              {savingFile ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save
                </>
              )}
            </button>
            <button 
              onClick={analyzeFile}
              disabled={!selectedFilePath || scanning}
              className="flex items-center bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded transition-colors"
            >
              {scanning ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Analyze File
                </>
              )}
            </button>
            <button 
              onClick={scanProject}
              disabled={scanningProject}
              className="flex items-center bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition-colors"
            >
              {scanningProject ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning Project...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Scan Project
                </>
              )}
            </button>
            <button 
              onClick={onClose}
              className="flex items-center bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;