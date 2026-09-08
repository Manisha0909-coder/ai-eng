import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, MessageSquare, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { useChatStore } from "@/store/chatStore";
import { generateChatId } from "@/utils/helper";
import { fetchUserMessages } from "@/services/chat/api";
import { useAppLocalState } from "@/hooks/useAppState";
import notify from "@/utils/notify";
import { Button } from "@/components/ui/button";
import { NewtonMark } from "@/components/branding/NewtonLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PersonaTypeAvatar } from "@/features/dashboard/components/PersonaTypeAvatar";
import { getDisplayInitials } from "@/features/dashboard/utils/dashboardHelper";

interface SearchResult {
  session_id: string;
  chat_title: string;
  preview_text: string;
  match_type: "title" | "message" | "assistant";
  rank: number;
  created_at: string;
  updated_at?: string;
  persona_id?: number;
  persona_name?: string;
}

interface SearchResultsViewProps {
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  onResultClick?: (sessionId: string) => void;
}

type TabFilter = "all" | "chats" | "messages";

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-accent/20 text-accent rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function NewtonIcon({ size = 14 }: { size?: number }) {
  return <NewtonMark size={size} tone="current" className="text-primary" />;
}

function SkeletonRow({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border-main">
      <div className="w-4 h-4 rounded bg-surface-2 animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3 rounded bg-surface-2 animate-pulse"
          style={{ width: wide ? "75%" : "55%" }}
        />
        <div
          className="h-2.5 rounded bg-surface-2 animate-pulse"
          style={{ width: wide ? "35%" : "25%" }}
        />
      </div>
    </div>
  );
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  onResultClick,
}) => {
  const navigate = useNavigate();
  const {
    setSessionId,
    setSelectedPersonaId,
    setSearchQuery,
    setSearchResults,
    setIsSearchModeActive,
    personas,
    searchPersonaIds,
    setSearchPersonaIds,
    setIsViewingArchivedSession,
  } = useStore();
  const { addChat, setCurrentChat, clearAllChats } = useChatStore();
  const { setIsLoadingMessages } = useAppLocalState();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  useEffect(() => {
    setSearchPersonaIds([]);
  }, [setSearchPersonaIds]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const activeSearchPersonaIds = Array.isArray(searchPersonaIds) ? searchPersonaIds : [];

  const handlePersonaFilterClear = () => setSearchPersonaIds([]);

  const handlePersonaFilterToggle = (personaId: number) => {
    const current = Array.isArray(searchPersonaIds) ? searchPersonaIds : [];
    if (current.includes(personaId)) {
      setSearchPersonaIds(current.filter((id) => id !== personaId));
    } else {
      setSearchPersonaIds([...current, personaId]);
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result.session_id);
      return;
    }

    try {
      setIsViewingArchivedSession(false);
      window.dispatchEvent(
        new CustomEvent("sessionLoading", { detail: { sessionId: result.session_id } })
      );
      setIsLoadingMessages(true);

      if (result.persona_id !== undefined && result.persona_id !== null) {
        setSelectedPersonaId(result.persona_id);
      }

      clearAllChats();
      setSessionId(result.session_id);

      let messages;
      try {
        messages = await fetchUserMessages(result.session_id);
      } catch (fetchError: any) {
        const status = fetchError?.response?.status || fetchError?.status;
        if (status === 403 || status === 404 || status === 400) {
          notify.error("You don't have access to this chat session or it no longer exists");
          setSessionId(null);
          clearAllChats();
          try { window.sessionStorage.setItem("newton.skipRouteSync", "true"); } catch {}
          navigate("/", { replace: true });
          window.dispatchEvent(new CustomEvent("clearStreamingChatState"));
          window.dispatchEvent(new Event("newChatSessionStarted"));
          const newChatId = generateChatId();
          addChat({ id: newChatId, title: "New Chat", timestamp: new Date(), messages: [] });
          setCurrentChat(newChatId);
          setIsLoadingMessages(false);
          return;
        }
        throw fetchError;
      }

      if (messages && messages.length > 0) {
        const transformedMessages = messages.map((msg) => ({
          ...msg,
          formfields: msg.formFields || null,
        }));
        const newChatId = generateChatId();
        addChat({
          id: newChatId,
          title: result.chat_title,
          timestamp: new Date(result.updated_at ?? result.created_at),
          messages,
        });
        setCurrentChat(newChatId);
        window.dispatchEvent(
          new CustomEvent("updateStreamingChatState", { detail: { messages: transformedMessages } })
        );
        window.dispatchEvent(new Event("sessionLoadingComplete"));
      } else {
        clearAllChats();
        window.dispatchEvent(new Event("sessionLoadingComplete"));
      }

      try { window.sessionStorage.setItem("newton.skipRouteSync", "false"); } catch {}
      window.dispatchEvent(new Event("resumeRouteSync"));
      navigate(`/chat/${result.session_id}`);
      setIsSearchModeActive(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      console.error("Failed to load chat session:", error);
      const status = error?.response?.status || error?.status;
      if (status === 403 || status === 404 || status === 400) {
        notify.error("You don't have access to this chat session or it no longer exists");
      } else {
        notify.error("Failed to load chat session");
      }
      window.dispatchEvent(new Event("sessionLoadingFailed"));
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const chatResults = searchResults.filter((r) => r.match_type === "title");
  const messageResults = searchResults.filter(
    (r) => r.match_type === "message" || r.match_type === "assistant"
  );

  const visibleChatResults =
    activeTab === "messages" ? [] : chatResults;
  const visibleMessageResults =
    activeTab === "chats" ? [] : messageResults;

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: searchResults.length },
    { key: "chats", label: "Chats", count: chatResults.length },
    { key: "messages", label: "Messages", count: messageResults.length },
  ];

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto h-full overflow-y-auto px-6 py-8">

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative mb-5"
      >
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats and messages…"
          className="w-full h-12 pl-11 pr-28 rounded-2xl border border-border-main bg-surface text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-elevated transition-shadow"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <kbd className="hidden sm:flex items-center h-6 px-2 rounded-md bg-surface-2 border border-border-main text-text-muted font-mono text-[10px]">
            ⌘K
          </kbd>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Filter tabs */}
      {(searchResults.length > 0 ||
        isSearching ||
        searchQuery.trim().length > 0 ||
        activeSearchPersonaIds.length > 0) && (
        <div className="flex items-center justify-between border-b border-border-main mb-5">
          <div className="flex items-center">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-3 text-sm -mb-px border-b-2 transition-colors",
                  activeTab === tab.key
                    ? "text-primary border-primary font-medium"
                    : "text-text-muted border-transparent hover:text-text-main"
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                      activeTab === tab.key
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-2 text-text-muted"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Persona filter */}
          {Array.isArray(personas) && personas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-xs text-text-muted hover:text-text-main gap-1.5 mb-1"
                >
                  {activeSearchPersonaIds.length === 0 ? (
                    <span>All personas</span>
                  ) : (
                    <div className="flex items-center -space-x-1">
                      {personas
                        .filter((p) => activeSearchPersonaIds.includes(p.id))
                        .slice(0, 3)
                        .map((p) => (
                          <span
                            key={p.id}
                            className={cn(
                              "inline-flex h-5 w-5 items-center justify-center rounded-md font-display text-[9px] font-semibold ring-1 ring-surface",
                              p.type === "dashboard"
                                ? "bg-accent/15 text-accent"
                                : "bg-primary/15 text-primary"
                            )}
                          >
                            {getDisplayInitials(p.persona_name)}
                          </span>
                        ))}
                      {activeSearchPersonaIds.length > 3 && (
                        <span className="text-[10px] text-text-muted pl-2">
                          +{activeSearchPersonaIds.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronDown size={12} className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-[200px]">
                <DropdownMenuItem
                  className={cn("text-xs gap-2.5", activeSearchPersonaIds.length === 0 && "font-medium")}
                  onSelect={(e) => { e.preventDefault(); handlePersonaFilterClear(); }}
                >
                  <span className="h-5 w-5 rounded-md bg-surface-2 border border-border-main shrink-0 flex items-center justify-center">
                    <Check size={10} className={activeSearchPersonaIds.length === 0 ? "opacity-100 text-primary" : "opacity-0"} />
                  </span>
                  All personas
                </DropdownMenuItem>
                {personas.map((persona) => {
                  const isSelected = activeSearchPersonaIds.includes(persona.id);
                  return (
                    <DropdownMenuItem
                      key={persona.id}
                      className={cn("text-xs gap-2.5", isSelected && "font-medium")}
                      onSelect={(e) => { e.preventDefault(); handlePersonaFilterToggle(persona.id); }}
                    >
                      <PersonaTypeAvatar
                        name={persona.persona_name}
                        type={persona.type}
                        size="sm"
                        className="h-5 w-5 text-[9px] shrink-0"
                      />
                      <span className="flex-1 truncate">{persona.persona_name}</span>
                      {isSelected && <Check size={11} className="text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          <div className="space-y-3">
            <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
            <SkeletonRow />
            <SkeletonRow wide />
          </div>
          <div className="space-y-3">
            <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
            <SkeletonRow wide />
            <SkeletonRow />
          </div>
        </motion.div>
      )}

      {/* Results */}
      {!isSearching && searchResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Chats group */}
          {visibleChatResults.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={13} className="text-text-muted" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  Chats
                </span>
              </div>
              <div className="space-y-1">
                {visibleChatResults.map((result, i) => (
                  <motion.div
                    key={result.session_id + "-title"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleResultClick(result)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:border-border-main hover:bg-surface cursor-pointer transition-all"
                  >
                    <MessageSquare size={14} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-text-main">
                        <HighlightText text={result.chat_title} query={searchQuery} />
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {result.persona_name && (
                          <span className="text-[10px] text-text-muted">{result.persona_name}</span>
                        )}
                        {result.persona_name && (
                          <span className="text-text-muted text-[10px]">·</span>
                        )}
                        <span className="text-[10px] text-text-muted">
                          {formatDate(result.updated_at ?? result.created_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Messages group */}
          {visibleMessageResults.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <NewtonIcon size={13} />
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  Messages
                </span>
              </div>
              <div className="space-y-1">
                {visibleMessageResults.map((result, i) => (
                  <motion.div
                    key={result.session_id + "-msg-" + i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => handleResultClick(result)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:border-border-main hover:bg-surface cursor-pointer transition-all"
                  >
                    <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <NewtonIcon size={11} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium truncate text-text-main flex-1">
                          {result.chat_title}
                        </p>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formatDate(result.updated_at ?? result.created_at)}
                        </span>
                      </div>
                      {result.preview_text && (
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                          <HighlightText text={result.preview_text} query={searchQuery} />
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Zero results */}
      {!isSearching && searchQuery && searchResults.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-surface border border-border-main rounded-2xl p-8 flex flex-col items-center text-center mt-2"
        >
          <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
            <Search size={26} strokeWidth={1.5} className="text-text-muted" />
          </div>
          <h2 className="font-display font-semibold text-base mb-1">
            No results for "{searchQuery}"
          </h2>
          <p className="text-sm text-text-muted">
            Try different keywords or check your spelling.
          </p>
        </motion.div>
      )}

      {/* Empty — no query */}
      {!isSearching && !searchQuery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
            <Search size={22} strokeWidth={1.5} className="text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">Start typing to search your chats</p>
        </motion.div>
      )}
    </div>
  );
};
