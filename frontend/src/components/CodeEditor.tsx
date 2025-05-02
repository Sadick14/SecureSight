import React, { useEffect, useState } from 'react';
import { Editor } from '@monaco-editor/react';

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
      return 'cpp';
    case 'cs':
    case 'csharp':
      return 'csharp';
    case 'go':
      return 'go';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
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

const renderFileTree = (items: FileTreeItem[], onFileClick: (path: string) => void, selectedFilePath: string | null) => {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.path}>
          <div
            className={`flex items-center cursor-pointer hover:bg-gray-700 p-1 rounded-md ${selectedFilePath === item.path ? 'bg-gray-700' : ''}`}
            onClick={() => item.type === 'file' && onFileClick(item.path)}
          >
            {item.type === 'dir' ? '📁' : '📄'}
            <span className="ml-2">{item.name}</span>
          </div>
          {item.children && item.children.length > 0 && (
            <div className="ml-4">
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
  const [error, setError] = useState<string | null>(null);

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
  };

  const language = selectedFilePath ? getLanguage(selectedFilePath) : 'plaintext';

  if (loadingFileTree) {
    return <div className="p-8 text-gray-400">Loading project structure...</div>;
  }

  if (error && !loadingFileContent) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex h-[600px] bg-gray-800 rounded-xl shadow-lg mt-4 text-white">
      {/* File Tree Sidebar */}
      <div className="w-64 bg-gray-900 p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Project Files</h3>
        {fileTreeData.length > 0 ? (
          renderFileTree(fileTreeData, handleFileTreeClick, selectedFilePath)
        ) : (
          <div className="text-gray-500 text-sm">No files found.</div>
        )}
      </div>

      {/* Code Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">{selectedFilePath || 'Select a file'}</h2>
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-700">
            Close Editor
          </button>
        </div>

        <div className="flex-1">
          {loadingFileContent ? (
            <div className="p-4 text-gray-400">Loading file content...</div>
          ) : selectedFilePath && fileContent !== null ? (
            <Editor
              height="100%"
              language={language}
              value={fileContent} // Use 'value' instead of 'defaultValue' to update content
              options={{
                readOnly: false,
                minimap: { enabled: false },
              }}
              onChange={(value) => {
                // You would handle saving changes here
                // console.log('Editor content changed:', value);
              }}
            />
          ) : (
            <div className="p-4 text-gray-400">Select a file from the sidebar to view its content.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;