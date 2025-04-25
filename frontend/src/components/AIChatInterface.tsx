import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PaperClipIcon, 
  XMarkIcon, 
  SparklesIcon, 
  MagnifyingGlassIcon,
  LightBulbIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  FolderIcon,
  TrashIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import Markdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { Tooltip } from 'react-tooltip';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
  references?: {
    repo?: string;
    files?: string[];
    vulnerability?: string;
    scanId?: string;
  };
  metadata?: {
    type?: 'analysis' | 'suggestion' | 'summary';
    vulnerabilities?: Vulnerability[];
    files?: FileAnalysis[];
  };
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file: string;
  line?: number;
  recommendedFix?: string;
  references?: string[];
}

interface FileAnalysis {
  filename: string;
  language: string;
  vulnerabilities: Vulnerability[];
  metrics: {
    complexity: number;
    lines: number;
    securityScore: number;
  };
}

interface Repository {
  id: string;
  name: string;
  scanResults?: any;
  lastScanned?: Date;
  scanHistory?: {
    id: string;
    date: Date;
    findings: number;
  }[];
}

interface Conversation {
  id: string;
  title: string;
  repo_name?: string;
  scan_id?: string;
  updated_at: string;
  messages: ChatMessage[];
}


export default function AIChatInterface({ repositories }: { repositories: Repository[] }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedScan, setSelectedScan] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [isDeepThinkMode, setIsDeepThinkMode] = useState(false);
  const [isFileAnalyzerOpen, setIsFileAnalyzerOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sample system prompt
  const systemPrompt = `You are SecureSight AI, a specialized AI assistant for security vulnerability analysis. 
  You help developers identify, understand, and fix security issues in their code. 
  Provide detailed, actionable advice with code examples when appropriate. 
  Format responses in Markdown with clear sections for Description, Risk, and Remediation.`;

  // Load conversations from API
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('http://localhost:8000/conversations', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [user]);

  // Initialize with system message and load conversations
  useEffect(() => {
    if (isOpen) {
      setMessages([{
        id: '1',
        content: systemPrompt,
        sender: 'system',
        timestamp: new Date()
      }]);
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const getCurrentRepoScanResults = () => {
    if (!selectedRepo) return null;
    const repo = repositories.find(r => r.name === selectedRepo);
    return repo?.scanResults || null;
  };

  const handleDeepThinkAnalysis = async () => {
    if (!selectedRepo || !user) return;
    
    setIsLoading(true);
    setIsDeepThinkMode(true);
    
    try {
      // First, get a high-level summary
      const summaryResponse = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({
          message: "Perform a DeepThink analysis of all vulnerabilities found in this repository. " +
                   "Provide a comprehensive report with severity breakdown, most critical issues, " +
                   "and recommended remediation steps.",
          repo_name: selectedRepo,
          scan_results: getCurrentRepoScanResults(),
          conversation_history: messages
        })
      });

      if (!summaryResponse.ok) throw new Error('DeepThink analysis failed');
      
      const summaryMessage = await summaryResponse.json();
      setMessages(prev => [...prev, {
        ...summaryMessage,
        timestamp: new Date(summaryMessage.timestamp),
        sender: 'ai',
        metadata: {
          type: 'summary'
        }
      }]);

      // Then analyze each critical vulnerability in detail
      const criticalVulnerabilities = getCriticalVulnerabilities();
      for (const vuln of criticalVulnerabilities) {
        const detailResponse = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.accessToken}`
          },
          body: JSON.stringify({
            message: `Analyze this critical vulnerability in detail: ${vuln.title}\n\n` +
                     `File: ${vuln.file}\nLine: ${vuln.line}\nDescription: ${vuln.description}`,
            repo_name: selectedRepo,
            scan_results: getCurrentRepoScanResults(),
            conversation_history: messages
          })
        });

        if (!detailResponse.ok) continue;
        
        const detailMessage = await detailResponse.json();
        setMessages(prev => [...prev, {
          ...detailMessage,
          timestamp: new Date(detailMessage.timestamp),
          sender: 'ai',
          metadata: {
            type: 'analysis',
            vulnerabilities: [vuln]
          }
        }]);
      }
    } catch (error) {
      console.error('DeepThink error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: 'DeepThink analysis failed. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setIsDeepThinkMode(false);
    }
  };

  const getCriticalVulnerabilities = (): Vulnerability[] => {
    if (!selectedRepo) return [];
    
    const repo = repositories.find(r => r.name === selectedRepo);
    if (!repo?.scanResults) return [];
    
    // Extract critical vulnerabilities from scan results
    const vulnerabilities: Vulnerability[] = [];
    
    Object.entries(repo.scanResults).forEach(([tool, result]) => {
      if (result?.findings) {
        result.findings.forEach((finding: any) => {
          if (finding.severity?.toLowerCase() === 'critical') {
            vulnerabilities.push({
              id: finding.id || `${tool}-${Date.now()}`,
              title: finding.title || finding.test_id || 'Critical Vulnerability',
              severity: 'critical',
              description: finding.description || finding.message || '',
              file: finding.path || '',
              line: finding.start?.line || finding.line_number,
              recommendedFix: finding.recommendedFix,
              references: finding.references
            });
          }
        });
      }
    });
    
    return vulnerabilities;
  };

  const handleSendMessage = async () => {
  if (!input.trim() || !user) return;

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    content: input,
    sender: 'user',
    timestamp: new Date(),
    references: {
      repo: selectedRepo,
      scanId: selectedScan,
      files: uploadedFiles.map(f => f.name)
    }
  };

  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);

  try {
    const requestBody = {
      message: input,
      context: {  // This must match your AnalysisContext model
        repo_name: selectedRepo,
        scan_results: getCurrentRepoScanResults(),
        file_names: uploadedFiles.map(f => f.name)
      },
      conversation_id: activeConversation,
      message_history: messages
        .filter(m => m.sender !== 'system')
        .map(m => ({
          id: m.id,
          content: m.content,
          sender: m.sender,
          timestamp: m.timestamp.toISOString(),
          references: m.references,
          metadata: m.metadata
        }))
    };

    const response = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.accessToken}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to get AI response');
    }

    const aiMessage = await response.json();
    setMessages(prev => [...prev, {
      ...aiMessage,
      timestamp: new Date(aiMessage.timestamp),
      sender: 'ai'
    }]);

    loadConversations();
  } catch (error) {
    console.error('AI error:', error);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: 'Sorry, I encountered an error. Please try again.',
      sender: 'ai',
      timestamp: new Date()
    }]);
  } finally {
    setIsLoading(false);
  }
};

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files || !user) return;

  const files = Array.from(e.target.files);
  setUploadedFiles(prev => [...prev, ...files]);
  setIsLoading(true);

  try {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    // Add other fields if needed
    if (selectedRepo) {
      formData.append('repo_name', selectedRepo);
    }
    formData.append('user_id', user.id);
    
    if (activeConversation) {
      formData.append('conversation_id', activeConversation);
    }

    const response = await fetch('http://localhost:8000/analyze-files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'File analysis failed');
    }

    const result = await response.json();
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: `### File Analysis Complete\n\nAnalyzed ${result.results.length} file(s) from ${result.repo || 'upload'}`,
      sender: 'ai',
      timestamp: new Date(),
      metadata: {
        type: 'analysis',
        files: result.results
      },
      references: {
        repo: result.repo,
        files: result.results.map((r: any) => r.filename)
      }
    }]);
  } catch (error) {
    console.error('File analysis error:', error);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: 'Failed to analyze files. Please try again.',
      sender: 'ai',
      timestamp: new Date()
    }]);
  } finally {
    setIsLoading(false);
  }
};

  const loadConversation = async (conversationId: string) => {
  try {
    const response = await fetch(`http://localhost:8000/conversations/${conversationId}`, {
      headers: {
        'Authorization': `Bearer ${user?.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load conversation');
    }

    const conversation = await response.json();
    
    // Reset messages with system prompt first
    setMessages([{
      id: '1',
      content: systemPrompt,
      sender: 'system',
      timestamp: new Date()
    }]);
    
    // Add conversation messages
    if (conversation.messages && conversation.messages.length > 0) {
      setMessages(prev => [
        ...prev,
        ...conversation.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      ]);
    }
    
    setActiveConversation(conversationId);
    
    // Set context from conversation
    setSelectedRepo(conversation.repo_name || '');
    setSelectedScan(conversation.scan_id || '');
    
  } catch (error) {
    console.error('Failed to load conversation:', error);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: 'Failed to load conversation',
      sender: 'system',
      timestamp: new Date()
    }]);
  }
};

  const renderMessageContent = (message: ChatMessage) => {
    if (message.metadata?.type === 'analysis' && message.metadata.files) {
      return (
        <div className="space-y-4">
          <Markdown>{message.content}</Markdown>
          {message.metadata.files.map((file: FileAnalysis) => (
            <div key={file.filename} className="bg-gray-700/50 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  {file.filename}
                </h4>
                <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                  {file.language}
                </span>
              </div>
              
              {file.vulnerabilities.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {file.vulnerabilities.slice(0, 3).map((vuln) => (
                    <div key={vuln.id} className="p-2 bg-gray-800 rounded border-l-4 border-red-500">
                      <div className="flex justify-between">
                        <span className="font-medium">{vuln.title}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          vuln.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          vuln.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {vuln.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">{vuln.description}</p>
                    </div>
                  ))}
                  {file.vulnerabilities.length > 3 && (
                    <div className="text-xs text-gray-400 text-center">
                      + {file.vulnerabilities.length - 3} more vulnerabilities
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-400">No vulnerabilities found</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    return <Markdown components={{
      code({node, inline, className, children, ...props}) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <SyntaxHighlighter
            style={atomOneDark}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
    }}>{message.content}</Markdown>;
  };

  const filteredConversations = conversations.filter(conv => 
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.repoName && conv.repoName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const availableScans = repositories.find(r => r.name === selectedRepo)?.scanHistory || [];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all flex items-center"
        data-tooltip-id="ai-chat-tooltip"
        data-tooltip-content="SecureSight AI Assistant"
      >
        <SparklesIcon className="h-6 w-6" />
        <Tooltip id="ai-chat-tooltip" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-8 w-[32rem] bg-gray-800 rounded-xl shadow-xl border border-gray-700 flex flex-col z-50">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-lg">SecureSight AI</h3>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setIsFileAnalyzerOpen(!isFileAnalyzerOpen)}
                className="p-1 text-gray-400 hover:text-white"
                data-tooltip-id="file-analyzer-tooltip"
                data-tooltip-content="File Analyzer"
              >
                <CodeBracketIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleDeepThinkAnalysis}
                disabled={isLoading || !selectedRepo}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                data-tooltip-id="deepthink-tooltip"
                data-tooltip-content="DeepThink Analysis"
              >
                <LightBulbIcon className="h-5 w-5" />
              </button>
              <button 
                onClick={() => {
                  setMessages([{
                    id: '1',
                    content: systemPrompt,
                    sender: 'system',
                    timestamp: new Date()
                  }]);
                  setActiveConversation(null);
                }}
                className="p-1 text-gray-400 hover:text-white"
                data-tooltip-id="new-chat-tooltip"
                data-tooltip-content="New Chat"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1 text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <Tooltip id="file-analyzer-tooltip" />
            <Tooltip id="deepthink-tooltip" />
            <Tooltip id="new-chat-tooltip" />
          </div>

          {/* File Analyzer Panel */}
          {isFileAnalyzerOpen && (
            <div className="border-b border-gray-700 p-4 bg-gray-800/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  File Analyzer
                </h4>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded flex items-center"
                >
                  <PaperClipIcon className="h-3 w-3 mr-1" />
                  Add Files
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  multiple
                />
              </div>
              
              {uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-700/30 p-2 rounded text-sm">
                      <div className="flex items-center truncate">
                        <DocumentTextIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-gray-400 p-4 border border-gray-700 rounded-lg border-dashed">
                  <p>Drag and drop files here or click "Add Files"</p>
                </div>
              )}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Conversations Sidebar */}
            <div className="w-48 border-r border-gray-700 bg-gray-800/50 flex flex-col">
              <div className="p-3 border-b border-gray-700">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search chats..."
                    className="w-full bg-gray-700 text-sm rounded pl-8 pr-3 py-1 focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <MagnifyingGlassIcon className="h-3.5 w-3.5 absolute left-2.5 top-1.5 text-gray-400" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length > 0 ? (
                  <ul className="space-y-1 p-2">
                    {filteredConversations.map((conv) => (
                      <li key={conv.id}>
                        <button
                          onClick={() => loadConversation(conv.id)}
                          className={`w-full text-left p-2 text-sm rounded truncate ${activeConversation === conv.id ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-gray-700'}`}
                        >
                          <div className="flex items-center">
                            {conv.repoName ? (
                              <FolderIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                            ) : (
                              <CommandLineIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                            )}
                            {conv.title}
                          </div>
                          {conv.repoName && (
                            <div className="text-xs text-gray-400 truncate">{conv.repoName}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-400">
                    {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[30rem]">
                {messages.filter(m => m.sender !== 'system').map((message) => (
                  <div
                    key={message.id}
                    className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <div
                      className={`inline-block max-w-full p-3 rounded-lg ${message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'}`}
                    >
                      {renderMessageContent(message)}
                      {message.references?.repo && (
                        <div className="text-xs mt-2 text-blue-300 flex items-center">
                          <FolderIcon className="h-3 w-3 mr-1" />
                          {message.references.repo}
                          {message.references.scanId && (
                            <span className="ml-2 text-gray-400">
                              (Scan: {message.references.scanId.slice(0, 6)})
                            </span>
                          )}
                        </div>
                      )}
                      {message.references?.files && message.references.files.length > 0 && (
                        <div className="text-xs mt-1 text-purple-300 flex items-center">
                          <DocumentTextIcon className="h-3 w-3 mr-1" />
                          {message.references.files.length} file(s)
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="text-left mb-4">
                    <div className="inline-block p-3 rounded-lg bg-gray-700 text-gray-100">
                      <div className="flex items-center space-x-2">
                        {isDeepThinkMode ? (
                          <>
                            <LightBulbIcon className="h-4 w-4 text-yellow-400" />
                            <span>DeepThinking...</span>
                          </>
                        ) : (
                          <>
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <span>Analyzing...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={selectedRepo}
                    onChange={(e) => {
                      setSelectedRepo(e.target.value);
                      setSelectedScan('');
                    }}
                    className="bg-gray-700 text-sm rounded p-2 focus:outline-none"
                  >
                    <option value="">Select repository...</option>
                    {repositories.map(repo => (
                      <option key={repo.id} value={repo.name}>
                        {repo.name} ({repo.scanHistory?.length || 0} scans)
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedScan}
                    onChange={(e) => setSelectedScan(e.target.value)}
                    disabled={!selectedRepo}
                    className="bg-gray-700 text-sm rounded p-2 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Latest scan</option>
                    {availableScans.map(scan => (
                      <option key={scan.id} value={scan.id}>
                        {new Date(scan.date).toLocaleDateString()} - {scan.findings} findings
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex">
                  <input
                    type="text"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about vulnerabilities..."
                    className="flex-1 bg-gray-700 rounded-l-lg p-3 focus:outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-r-lg px-4 flex items-center"
                  >
                    {isLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}