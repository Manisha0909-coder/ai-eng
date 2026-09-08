import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { ExternalLink, Loader2, Copy, Check, File, FileText, FileImage, FileSpreadsheet, FileVideo, FileAudio, FileCode, Globe, Download } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from 'axios';
import notify from '@/utils/notify';
import { API_CONFIG } from '@/config/api';

type DocumentSearchItem = {
  id: number;
  title: string;
  url: string;
  content: string;
};

// File type icon component
const FileTypeIcon: React.FC<{ url: string; title: string }> = ({ url }) => {
  const getFileExtension = (url: string) => {
    const path = url.split('?')[0]; // Remove query parameters
    const extension = path.split('.').pop()?.toLowerCase();
    return extension;
  };

  const getFileIcon = (extension: string | undefined) => {
    switch (extension) {
      case 'pdf':
        return <FileText className="w-5 h-5" style={{ color: 'var(--color-error)' }} />;
      case 'doc':
      case 'docx':
        return <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--color-success)' }} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <FileImage className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return <FileVideo className="w-5 h-5" style={{ color: 'var(--color-info)' }} />;
      case 'mp3':
      case 'wav':
      case 'flac':
        return <FileAudio className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} />;
      case 'html':
      case 'htm':
        return <Globe className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />;
      case 'css':
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'csv':
        return <FileCode className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />;
      default:
        return <File className="w-5 h-5" style={{ color: 'var(--color-text)' }} />;
    }
  };

  const extension = getFileExtension(url);

  return (
    <div
      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid rgb(var(--color-border))' }}
    >
      {getFileIcon(extension)}
    </div>
  );
};

// Normalize analysis text: remove stray lines that contain only a period, then
// ensure links start on a new line and the final char ends with terminal punctuation.
const formatAnalysis = (analysis: string) => {
  if (!analysis) return analysis;
  let formatted = analysis;

  // Remove lines that are just a '.' (common in generated text after links)
  formatted = formatted.replace(/^\s*\.\s*$/gm, '').trim();

  // Normalize markdown hard breaks (two spaces then newline) to a single newline
  formatted = formatted.replace(/\s{2,}\n/g, '\n');

  // Ensure each markdown link starts on its own line
  // Case 1: text then spaces then link → put link on new line
  formatted = formatted.replace(/([^\n])\s*(\[[^\]]+\]\([^\)]+\))/g, '$1\n$2');

  // Case 2: consecutive links separated by spaces → each on its own line
  formatted = formatted.replace(/\)\s*(?=\[)/g, ')\n');

  // Collapse 3+ consecutive newlines to max 2
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Ensure final punctuation
  if (!/[.?!)]$/.test(formatted)) {
    formatted += '.';
  }
  return formatted;
};

export default function DocumentSearch({
  analysis,
  items,
}: {
  analysis: string;
  items: DocumentSearchItem[];
}) {
  const sources = items || [];
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(analysis);
      setIsCopied(true);
      notify.success('Analysis copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      notify.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = async (source: DocumentSearchItem) => {

    // Add file to downloading set
    setDownloadingFiles(prev => new Set(prev).add(source.id.toString()));

    try {
      const downloadUrl = source.url.startsWith("http") 
        ? source.url 
        : `${API_CONFIG.LOCAL_API_BASE_URL}${source.url}`;
      
      // Force direct download without file explorer dialog
      const response = await axios.get(downloadUrl, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        withCredentials: true,
        responseType: 'blob',
      });

      // Create blob with proper MIME type
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      
      // Create download link and trigger download immediately
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = source.title;
      link.style.display = 'none';
      
      // Append to body, click immediately, then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error("Error downloading file:", error);
    } finally {
      // Remove file from downloading set
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(source.id.toString());
        return newSet;
      });
    }
  };

  if (!analysis) return null;

  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: 'rgb(var(--color-border))',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)'
      }}
    >
      <Tabs defaultValue="analysis" className="w-full">
        <div className="px-4 pt-3">
          <TabsList
            className="flex w-1/2 justify-start"
            style={{
              background: 'transparent',
              // borderBottom: '1px solid rgb(var(--color-border))'
            }}
          >
            <TabsTrigger
              value="analysis"
              className="relative px-4 py-2 text-sm font-medium text-var(--color-text) transition-all duration-200 data-[state=active]:bg-var(--color-surface) data-[state=active]:shadow-lg data-[state=active]:shadow-black/20 data-[state=active]:ring-1 data-[state=active]:ring-white/10"
              style={{ 
               color: 'var(--color-text)'
              }}
            >
              Analysis
            </TabsTrigger>
            <TabsTrigger
              value="sources"
              className="relative px-4 py-2 text-sm font-medium text-var(--color-text) transition-all duration-200 data-[state=active]:bg-var(--color-surface) data-[state=active]:shadow-lg data-[state=active]:shadow-black/20 data-[state=active]:ring-1 data-[state=active]:ring-white/10"
              style={{ 
                color: 'var(--color-text)'
               }}
              >
              Sources
              {sources && sources.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-surface text-text-main">
                  {sources.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analysis" className="space-y-3 p-4 h-[300px] w-[380px] sm:w-[800px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
              Document Analysis
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 w-6 p-0"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <ReactMarkdown
              components={{
              p: ({ node, ...props }) => (
                <p className="mb-[8px]" style={{ color: 'var(--color-text)' }} {...props} />
              ),
              a: ({node, ...props}) => {
                const text = props.children?.toString().trim() || "";
                // Try multiple matching strategies
                let matchingSource = sources.find(source => 
                  props.href === source.url || text.includes(source.title)
                );
                // Numeric link like [1], [2]
                if (!matchingSource) {
                  const num = Number(text);
                  if (!Number.isNaN(num) && num > 0) {
                    matchingSource =
                      sources.find(s => s.id === num) ||
                      sources[num - 1];
                  }
                }
                
                if (matchingSource) {
                  return (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-4 w-2 px-2 py-2 items-center border decoration-none" 
                          style={{ color: 'var(--color-text)',backgroundColor: 'var(--color-surface)',borderColor: 'rgb(var(--color-border))',textDecoration: 'none' }}
                          // onClick={() => handleDownload(matchingSource)}
                        >
                          <span className="cursor-pointer text-xs" style={{ color: 'var(--color-text)',textDecoration: 'none' }}>
                            {props.children}
                          </span>
                        </Button>
                      </HoverCardTrigger>
                      
                      <HoverCardPrimitive.Portal>
                        <HoverCardContent 
                          className="w-80 z-[99999] overflow-auto !fixed"  
                          align="center" 
                          side="top" 
                          sideOffset={5}
                          avoidCollisions={true}
                          collisionPadding={20}
                          style={{
                            backgroundColor: 'var(--color-background)',
                            color: 'var(--color-text)',
                            border: '1px solid rgb(var(--color-border))'
                          }}
                        >
                          <div className="space-y-2" style={{ color: 'var(--color-text)' }}>
                            <h5 className="text-sm font-medium break-words whitespace-pre-wrap">
                              {matchingSource.title}
                            </h5>
                            <p className="text-xs whitespace-pre-wrap break-words h-24 overflow-auto scrollbar-hide">
                              {matchingSource.content}
                            </p>
                             <button
                               onClick={() => handleDownload(matchingSource)}
                               disabled={downloadingFiles.has(matchingSource.id.toString())}
                               className="group relative text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-300 ease-out overflow-hidden disabled:opacity-50"
                               style={{
                                 background: 'var(--color-surface)',
                                 border: '1px solid rgb(var(--color-primary) / 0.3)',
                                 color: 'var(--color-text)',
                                 textShadow: '0 0 8px rgb(var(--color-primary) / 0.5)',
                                 boxShadow: '0 0 20px rgb(var(--color-primary) / 0.2), inset 0 1px 0 rgb(var(--color-primary-foreground) / 0.1)'
                               }}
                             >
                              <div 
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{
                                  background: 'linear-gradient(135deg, rgb(var(--color-primary) / 0.2) 0%, rgb(var(--color-secondary) / 0.2) 100%)',
                                  filter: 'blur(1px)'
                                }}
                              />
                              <div 
                                className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{
                                  background: 'linear-gradient(135deg, rgb(var(--color-primary) / 0.6), rgb(var(--color-secondary) / 0.6))',
                                  padding: '1px',
                                  WebkitMask: 'linear-gradient(white 0 0) content-box, linear-gradient(white 0 0)',
                                  WebkitMaskComposite: 'xor',
                                  maskComposite: 'exclude'
                                }}
                              />
                               <span className="relative z-10 font-medium tracking-wide">
                                 {downloadingFiles.has(matchingSource.id.toString()) ? 'Downloading...' : 'Download'}
                               </span>
                               {downloadingFiles.has(matchingSource.id.toString()) ? (
                                 <Loader2 
                                   size={10} 
                                   className="relative z-10 animate-spin"
                                   style={{
                                     filter: 'drop-shadow(0 0 4px rgb(var(--color-primary) / 0.6))'
                                   }}
                                 />
                               ) : (
                                 <ExternalLink 
                                   size={10} 
                                   className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                   style={{
                                     filter: 'drop-shadow(0 0 4px rgb(var(--color-primary) / 0.6))'
                                   }}
                                 />
                               )}
                              <div 
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{
                                  background: 'var(--color-surface)',
                                  animation: 'scan 2s ease-in-out infinite'
                                }}
                              />
                            </button>
                          </div>
                        </HoverCardContent>
                      </HoverCardPrimitive.Portal>
                    </HoverCard>
                  );
                }
                
                // Default link if no matching source found
                return (
                  <a
                    {...props}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {props.children}
                  </a>
                );
              }
            }}>
              {formatAnalysis(analysis)}</ReactMarkdown>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-3 p-5 h-[300px] w-[380px] sm:w-[800px] overflow-y-auto">
          <div className="space-y-4">
            {sources && sources.length > 0 ? (
              sources.map((source) => (
                <div 
                  key={source.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:shadow-sm transition-all duration-200 "
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'rgb(var(--color-border))'
                  }}
                >
                  {/* File Type Icon */}
                  <FileTypeIcon url={source.url} title={source.title} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1 truncate">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {source.title}
                      </span>
                    </div>
                    {/* <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline block mb-2 break-all"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {source.url}
                    </a> */}
                    {source.content && (
                      <p className="text-sm leading-relaxed h-[60px] sm:h-[100px]  overflow-y-auto " style={{ color: 'var(--color-text)' }}>
                        {source.content}
                      </p>
                    )}
                  </div>
                  
                  {/* Download Button */}
                  <Button
                    size="sm"
                    onClick={() => handleDownload(source)}
                    disabled={downloadingFiles.has(source.id.toString())}
                    className="h-8 px-3 flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                  >
                    {downloadingFiles.has(source.id.toString()) ? (
                      <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Downloading</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Download size={12} /> </span>
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No sources available
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}