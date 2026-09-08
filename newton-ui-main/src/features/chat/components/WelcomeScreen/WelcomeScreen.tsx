import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  LayoutDashboard,
  Search,
  Clock,
  Star,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { useStore, type Persona } from "@/store/useStore";
import {
  fetchUserProfile,
  userApiService,
  type UserProfile,
} from "@/services/user/userApi";
import { getDisplayInitials } from "@/features/dashboard/utils/dashboardHelper";
import { cn } from "@/lib/utils";

const RECENT_PERSONAS_KEY = "newton.recentPersonas";
const MAX_RECENT = 4;



const readRecentIds = (): number[] => {
  try {
    const raw = localStorage.getItem(RECENT_PERSONAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
};

const pushRecentId = (id: number) => {
  try {
    const current = readRecentIds().filter((n) => n !== id);
    const next = [id, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_PERSONAS_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable; recents won't persist.
  }
};

type ChatType = "analytical" | "dashboard";

const MODE_META: Record<ChatType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  analytical: {
    label: "Chat",
    description: "Conversational AI for tasks, questions, and brainstorming.",
    icon: MessageSquare,
  },
  dashboard: {
    label: "Dashboard",
    description: "Analytics, monitoring, and AI-powered insights.",
    icon: LayoutDashboard,
  },
};

interface ModeCardProps {
  type: ChatType;
  disabled?: boolean;
  onSelect: (type: ChatType) => void;
}

const ModeCard: React.FC<ModeCardProps> = ({ type, disabled, onSelect }) => {
  const meta = MODE_META[type];
  const Icon = meta.icon;
  const colorVar = type === "dashboard" ? "--color-accent" : "--color-primary";
  const hoverBorderClass = type === "dashboard" ? "hover:border-accent" : "hover:border-primary";

  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onSelect(type)}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all duration-300 ${
        disabled
          ? "opacity-40 cursor-not-allowed border-border-main"
          : `border-border-main cursor-pointer ${hoverBorderClass}`
      }`}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent) 0%, color-mix(in srgb, var(--color-surface) 70%, transparent) 100%)",
      }}
      aria-label={`Select ${meta.label} mode`}
    >
      {/* Animated accent line — slides in on hover */}
      <div
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
        style={{
          background: `linear-gradient(90deg, transparent, rgb(var(${colorVar})), transparent)`,
        }}
      />

      {/* Soft accent glow — appears on hover */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, rgb(var(${colorVar})) 30%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105",
              type === "dashboard" ? "text-accent" : "text-primary",
            )}
            style={{
              background: `linear-gradient(135deg, rgb(var(${colorVar}) / 0.18), rgb(var(${colorVar}) / 0.10))`,
              boxShadow: `inset 0 0 0 1px rgb(var(${colorVar}) / 0.25)`,
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <motion.div
            initial={{ x: -6, opacity: 0 }}
            whileHover={{ x: 0, opacity: 1 }}
            className="text-text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-main">
            {meta.label}
          </h3>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            {meta.description}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

interface PersonaCardProps {
  persona: Persona;
  selected: boolean;
  pending?: boolean;
  onSelect: (id: number) => void;
  starred?: boolean;
  onToggleStar?: (persona: Persona) => void;
}

const tagsFor = (p: Persona): string[] => {
  const tags: string[] = [];
  if (Array.isArray(p.tool_tags) && p.tool_tags.length > 0) {
    p.tool_tags.slice(0, 2).forEach((t: any) => {
      const label = typeof t === "string" ? t : t?.name || t?.label;
      if (label) tags.push(String(label));
    });
  }
  if (p.has_datasources) tags.push("Data");
  if (p.supports_documents) tags.push("Docs");
  return tags.slice(0, 3);
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PersonaCard: React.FC<PersonaCardProps & { index?: number }> = ({
  persona,
  selected,
  pending,
  onSelect,
  starred = false,
  onToggleStar,
  index = 0,
}) => {
  const tags = tagsFor(persona);
  const highlighted = selected || pending;
  const initials = getDisplayInitials(persona.persona_name);

  return (
    <motion.button
      type="button"
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
      onClick={() => onSelect(persona.id)}
      className={`group relative flex flex-col overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-200 ${
        highlighted
          ? "border-primary shadow-lift"
          : "border-border-main hover:border-primary/40 hover:shadow-lift"
      }`}
      style={{
        background: "color-mix(in srgb, var(--color-surface) 95%, transparent)",
        boxShadow: highlighted
          ? "0 0 0 1px color-mix(in srgb, var(--color-primary) 40%, transparent), 0 8px 24px -12px color-mix(in srgb, var(--color-primary) 20%, transparent)"
          : undefined,
      }}
      aria-pressed={selected}
      aria-label={`Select persona ${persona.persona_name}`}
    >
      {/* Checkmark badge — absolute top-right when selected */}
      <AnimatePresence>
        {highlighted && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full"
            style={{ background: "rgb(var(--color-primary))" }}
          >
            <Check className="h-2.5 w-2.5 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Star toggle — marks this persona as the default for its workspace.
          Rendered as a span (a button cannot nest inside the card button). */}
      {!highlighted && onToggleStar && (
        <span
          role="button"
          tabIndex={0}
          title={
            starred
              ? "Unstar to stop opening this persona by default"
              : "Star to make this your default persona"
          }
          aria-label={
            starred
              ? `Unstar ${persona.persona_name}`
              : `Star ${persona.persona_name} as default`
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(persona);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleStar(persona);
            }
          }}
          className={cn(
            "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200",
            starred
              ? "text-yellow-400 opacity-100"
              : "text-text-muted opacity-0 hover:text-yellow-400 group-hover:opacity-100 focus-visible:opacity-100"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", starred && "fill-current")} />
        </span>
      )}

      {/* Initials avatar */}
      <div
        className={cn(
          "mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg font-display text-sm font-semibold",
          persona.type === "dashboard"
            ? "text-accent [background:linear-gradient(135deg,rgb(var(--color-accent)/0.15),rgb(var(--color-accent)/0.08))] [box-shadow:inset_0_0_0_1px_rgb(var(--color-accent)/0.18)]"
            : "text-primary [background:linear-gradient(135deg,rgb(var(--color-primary)/0.15),rgb(var(--color-primary)/0.08))] [box-shadow:inset_0_0_0_1px_rgb(var(--color-primary)/0.18)]",
        )}
      >
        {initials}
      </div>

      {/* Name */}
      <div className="mb-0.5 truncate pr-5 text-sm font-medium leading-snug text-text-main">
        {persona.persona_name}
      </div>

      {/* Type */}
      <div className="mb-2 text-2xs uppercase tracking-wider text-text-muted">
        {persona.type === "dashboard" ? "Dashboard" : "Chat"}
      </div>

      {/* Capability tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-border-main bg-surface-2 px-1.5 py-0.5 text-2xs text-text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
};

const PersonaCardSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.04 }}
    className="flex h-full flex-col gap-2 rounded-xl border border-border-main bg-surface p-3"
  >
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 flex-shrink-0 animate-pulse rounded-md bg-border-main" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-3/4 animate-pulse rounded bg-border-main" />
        <div className="h-2 w-1/3 animate-pulse rounded bg-border-main" />
      </div>
    </div>
    <div className="mt-auto flex gap-1">
      <div className="h-3 w-10 animate-pulse rounded-full bg-border-main" />
      <div className="h-3 w-8 animate-pulse rounded-full bg-border-main" />
    </div>
  </motion.div>
);

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25 } },
};

export const WelcomeScreen: React.FC = () => {
  const {
    personas,
    personasFetched,
    selectedPersonaId,
    newChatType,
    setNewChatType,
    setSelectedPersonaId,
    defaultPersonas,
    setDefaultPersonas,
    setPersonas,
  } = useStore();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentIds, setRecentIds] = useState<number[]>(() => readRecentIds());
  const [typedGreeting, setTypedGreeting] = useState("");
  const [isTypingGreeting, setIsTypingGreeting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchUserProfile();
        if (!cancelled) setUserProfile(profile);
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset the persisted persona on a truly fresh visit (no workspace chosen
  // yet) so the picker is the first thing the user sees. If newChatType is
  // already set we're not "fresh" — e.g., the user just switched personas
  // from the Header mid-conversation and the new chat is ready to receive
  // their first message. Clearing in that case would wipe the freshly-set
  // persona and bounce them back into the picker.
  useEffect(() => {
    if (newChatType === null) {
      setSelectedPersonaId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatPersonas = useMemo(
    () => personas.filter((p) => (p.type ?? "chat") === "chat"),
    [personas]
  );
  const dashboardPersonas = useMemo(
    () => personas.filter((p) => p.type === "dashboard"),
    [personas]
  );
  const hasChat = chatPersonas.length > 0;
  const hasDashboard = dashboardPersonas.length > 0;

  const modePersonas = useMemo(() => {
    if (newChatType === null) return [];
    return newChatType === "analytical" ? chatPersonas : dashboardPersonas;
  }, [chatPersonas, dashboardPersonas, newChatType]);

  // When only one persona type exists, auto-pick the mode.
  useEffect(() => {
    if (!personasFetched || personas.length === 0) return;
    if (hasChat && !hasDashboard && newChatType === null) {
      setNewChatType("analytical");
    } else if (!hasChat && hasDashboard && newChatType === null) {
      setNewChatType("dashboard");
    }
  }, [personasFetched, personas.length, hasChat, hasDashboard, newChatType, setNewChatType]);

  // Exactly one persona total → skip selection entirely.
  useEffect(() => {
    if (personas.length === 1 && newChatType === null) {
      const only = personas[0];
      setNewChatType((only.type ?? "chat") === "dashboard" ? "dashboard" : "analytical");
      setSelectedPersonaId(only.id);
    }
  }, [personas, newChatType, setNewChatType, setSelectedPersonaId]);

  // Entering a workspace with a starred default (or a single available
  // persona) skips the picker. Deliberately NOT keyed on defaultPersonas:
  // starring a card while browsing must only mark it, not yank the user
  // into a chat — so defaults are read fresh from the store instead.
  useEffect(() => {
    if (!personasFetched || newChatType === null) return;
    const state = useStore.getState();
    if (state.selectedPersonaId != null) return;
    const modeKey = newChatType === "dashboard" ? "dashboard" : "chat";
    const list = state.personas.filter(
      (p) => (p.type ?? "chat") === modeKey
    );
    const starredId = state.defaultPersonas[modeKey];
    if (starredId != null && list.some((p) => p.id === starredId)) {
      setSelectedPersonaId(starredId);
      return;
    }
    if (list.length === 1) {
      setSelectedPersonaId(list[0].id);
    }
  }, [personasFetched, newChatType, setSelectedPersonaId]);

  /** Star/unstar a persona as the default for its workspace (optimistic). */
  const handleToggleStar = useCallback(
    async (persona: Persona) => {
      const modeKey = (persona.type ?? "chat") === "dashboard" ? "dashboard" : "chat";
      const previous = defaultPersonas;
      const isStarred = previous[modeKey] === persona.id;
      const next = { ...previous, [modeKey]: isStarred ? null : persona.id };
      setDefaultPersonas(next);
      setPersonas(
        personas.map((p) => ({
          ...p,
          is_default:
            (p.type ?? "chat") === modeKey
              ? next[modeKey] === p.id
              : p.is_default,
        }))
      );
      try {
        if (isStarred) {
          await userApiService.clearDefaultPersona(modeKey);
        } else {
          await userApiService.setDefaultPersona(persona.id);
        }
      } catch (err) {
        console.error("Failed to update default persona:", err);
        setDefaultPersonas(previous);
        setPersonas(
          personas.map((p) => ({
            ...p,
            is_default:
              (p.type ?? "chat") === modeKey
                ? previous[modeKey] === p.id
                : p.is_default,
          }))
        );
      }
    },
    [defaultPersonas, personas, setDefaultPersonas, setPersonas]
  );

  const handleModeSelect = useCallback(
    (type: ChatType) => {
      setNewChatType(type);
      setSelectedPersonaId(null);
      setSearchQuery("");
    },
    [setNewChatType, setSelectedPersonaId]
  );

  /** Click a persona card → commit immediately, no staging. */
  const handlePersonaPick = useCallback(
    (id: number) => {
      setSelectedPersonaId(id);
      pushRecentId(id);
      setRecentIds(readRecentIds());
    },
    [setSelectedPersonaId]
  );

  const handleBackToMode = useCallback(() => {
    setNewChatType(null);
    setSelectedPersonaId(null);
    setSearchQuery("");
  }, [setNewChatType, setSelectedPersonaId]);

  const selectedPersona: Persona | undefined =
    selectedPersonaId != null
      ? personas.find((p) => p.id === selectedPersonaId)
      : undefined;

  const { recommended, recents, rest } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = (p: Persona) => {
      if (!q) return true;
      const haystack = [p.persona_name, p.display_text, p.greeting_message, p.persona]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    };

    const visible = modePersonas.filter(matches);
    const recentSet = new Set(recentIds);

    const recentVisible: Persona[] = [];
    recentIds.forEach((id) => {
      const found = visible.find((p) => p.id === id);
      if (found) recentVisible.push(found);
    });

    const recommendedVisible = visible.filter(
      (p) => p.is_default && !recentSet.has(p.id)
    );
    const recommendedIds = new Set(recommendedVisible.map((p) => p.id));
    const restVisible = visible.filter(
      (p) => !recentSet.has(p.id) && !recommendedIds.has(p.id)
    );

    return { recommended: recommendedVisible, recents: recentVisible, rest: restVisible };
  }, [modePersonas, recentIds, searchQuery]);

  const givenName = userProfile?.given_name || "";
  const greetingTitle = givenName ? `Hi, ${givenName}` : "Welcome back";

  const showModeSelection =
    personasFetched &&
    personas.length > 0 &&
    newChatType === null &&
    hasChat &&
    hasDashboard;

  const showPersonaPicker =
    personasFetched &&
    personas.length > 0 &&
    newChatType !== null &&
    selectedPersona == null;

  const showPersonaSelected = personasFetched && selectedPersona != null;
  const showEmptyState = personasFetched && personas.length === 0;

  // The full greeting text we want to type out when a persona is selected.
  const personaGreeting =
    selectedPersona?.greeting_message?.trim() || "Ready when you are.";

  // Static subtitle for non-selected states — adapts per step.
  const staticSubtitle = showModeSelection
    ? "Choose a workspace to continue."
    : showPersonaPicker
    ? "Your AI team is ready. Pick a persona to begin."
    : "Setting things up…";

  /**
   * Typing animation — variable speed (faster on space, slower on word chars,
   * pause after sentence punctuation). Mirrors how a real typist behaves.
   */
  useEffect(() => {
    if (!showPersonaSelected) {
      setTypedGreeting("");
      setIsTypingGreeting(false);
      return;
    }
    let cancelled = false;
    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    setTypedGreeting("");
    setIsTypingGreeting(true);
    const delayFor = (char: string): number => {
      if (/[.!?]/.test(char)) return 240; // long pause after sentence end
      if (/[,;:—]/.test(char)) return 140; // short pause after clause break
      if (char === " ") return 14;
      // jitter slightly so it feels organic
      return 22 + Math.floor(Math.random() * 18);
    };
    const tick = () => {
      if (cancelled) return;
      if (index < personaGreeting.length) {
        const nextIndex = index + 1;
        setTypedGreeting(personaGreeting.slice(0, nextIndex));
        const justTyped = personaGreeting[index];
        index = nextIndex;
        timeoutId = setTimeout(tick, delayFor(justTyped));
      } else {
        setIsTypingGreeting(false);
      }
    };
    timeoutId = setTimeout(tick, 200);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [showPersonaSelected, personaGreeting, selectedPersonaId]);

  // Keyboard navigation: Escape returns to mode selection when both modes exist.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPersonaPicker && hasChat && hasDashboard) {
        handleBackToMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPersonaPicker, hasChat, hasDashboard, handleBackToMode]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full justify-center overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-6 md:py-12 ${
        showPersonaSelected ? "items-center" : "items-start"
      }`}
    >
      {/* Background atmosphere — very subtle gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4 }}
          className="absolute -top-32 left-1/2 h-[360px] w-[560px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2 }}
          className="absolute -bottom-32 right-0 h-[320px] w-[320px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 8%, transparent), transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Loading */}
        <AnimatePresence mode="wait">
          {isLoadingProfile && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
            >
              <div className="relative">
                <div className="h-14 w-14 rounded-full border-2 border-border-main" />
                <motion.div
                  className="absolute inset-0 h-14 w-14 rounded-full border-2 border-transparent"
                  style={{
                    borderTopColor: "rgb(var(--color-primary))",
                    borderRightColor: "rgb(var(--color-secondary))",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="text-sm text-text-muted"
              >
                Initializing your workspace…
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!isLoadingProfile && showEmptyState && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-border-main bg-surface p-8 text-center"
          >
            <h2 className="text-lg font-semibold text-text-main">
              No personas available
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Your account doesn't have any AI personas yet. Please contact your administrator for access.
            </p>
          </motion.div>
        )}

        {/* Greeting */}
        {!isLoadingProfile && !showEmptyState && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`mx-auto max-w-3xl text-center ${
              showPersonaSelected ? "mb-6" : "mb-10"
            }`}
          >

            <h1 className="inline-flex items-baseline gap-1 text-3xl font-semibold md:text-4xl">
              <span
                style={{
                  background:
                    "linear-gradient(135deg, rgb(var(--color-text)), color-mix(in srgb, rgb(var(--color-primary)) 65%, rgb(var(--color-text))))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {greetingTitle}
              </span>
              <motion.span
                className="inline-block w-[2px] self-stretch rounded-full"
                style={{ background: "rgb(var(--color-primary))", minHeight: "0.85em" }}
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  times: [0, 0.5, 0.5, 1],
                  ease: "linear",
                }}
                aria-hidden="true"
              />
            </h1>
            <p className="mt-3 min-h-icon-md text-base text-text-muted">
              {showPersonaSelected ? (
                <>
                  {typedGreeting}
                  {isTypingGreeting && (
                    <motion.span
                      className="ml-0.5 inline-block h-4 w-[2px] align-middle"
                      style={{ background: "rgb(var(--color-primary))" }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </>
              ) : (
                staticSubtitle
              )}
            </p>
          </motion.div>
        )}

        {/* Step 1 — Mode selection */}
        <AnimatePresence mode="wait">
          {showModeSelection && (
            <motion.section
              key="mode-selection"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mx-auto max-w-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Step 1 of 2
                </p>
                <div className="flex items-center gap-1.5">
                  <motion.span
                    layoutId="step-indicator-active"
                    className="h-1 w-6 rounded-full bg-primary"
                  />
                  <span className="h-1 w-6 rounded-full bg-border-main" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModeCard
                  type="analytical"
                  disabled={!hasChat}
                  onSelect={handleModeSelect}
                />
                <ModeCard
                  type="dashboard"
                  disabled={!hasDashboard}
                  onSelect={handleModeSelect}
                />
              </div>
            </motion.section>
          )}

          {/* Step 2 — Persona selection */}
          {showPersonaPicker && (
            <motion.section
              key="persona-picker"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mx-auto max-w-5xl"
            >
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {hasChat && hasDashboard && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBackToMode}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border-main bg-surface text-text-muted transition-colors hover:border-primary hover:text-text-main"
                      aria-label="Back to workspace selection"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </motion.button>
                  )}
                  <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    Step 2 of 2 · {newChatType === "analytical" ? "Chat" : "Dashboard"}
                  </p>
                </div>

                {hasChat && hasDashboard && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-border-main bg-surface p-1">
                    {(["analytical", "dashboard"] as ChatType[]).map((t) => {
                      const meta = MODE_META[t];
                      const Icon = meta.icon;
                      const active = newChatType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleModeSelect(t)}
                          className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "text-primary-foreground"
                              : "text-text-muted hover:text-text-main"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="mode-toggle-pill"
                              className="absolute inset-0 rounded-full"
                              style={{ background: "rgb(var(--color-primary))" }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}
                          <Icon className="relative h-3.5 w-3.5" />
                          <span className="relative">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="group relative mb-6">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors duration-300 group-focus-within:text-primary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search personas…"
                  className="w-full rounded-xl border border-border-main py-2.5 pl-11 pr-4 text-sm text-text-main placeholder:text-text-muted outline-none backdrop-blur-xl transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 90%, transparent), color-mix(in srgb, var(--color-surface) 70%, transparent))",
                    boxShadow: searchQuery
                      ? "0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent)"
                      : undefined,
                  }}
                  aria-label="Search personas"
                />
                {/* Animated underline accent */}
                <div
                  className="pointer-events-none absolute inset-x-3 -bottom-px h-px origin-center scale-x-0 transition-transform duration-500 group-focus-within:scale-x-100"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgb(var(--color-primary)), rgb(var(--color-secondary)), transparent)",
                  }}
                />
              </div>

              {/* Skeletons */}
              {!personasFetched && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <PersonaCardSkeleton key={i} index={i} />
                  ))}
                </div>
              )}

              {/* Recently used */}
              {personasFetched && recents.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    <Clock className="h-3 w-3" /> Recently used
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {recents.map((p, i) => (
                      <PersonaCard
                        key={p.id}
                        persona={p}
                        selected={false}
                        index={i}
                        onSelect={handlePersonaPick}
                        starred={defaultPersonas[(p.type ?? "chat") === "dashboard" ? "dashboard" : "chat"] === p.id}
                        onToggleStar={handleToggleStar}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended */}
              {personasFetched && recommended.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-3 inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    <Star className="h-3 w-3" /> Recommended
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {recommended.map((p, i) => (
                      <PersonaCard
                        key={p.id}
                        persona={p}
                        selected={false}
                        index={i}
                        onSelect={handlePersonaPick}
                        starred={defaultPersonas[(p.type ?? "chat") === "dashboard" ? "dashboard" : "chat"] === p.id}
                        onToggleStar={handleToggleStar}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All */}
              {personasFetched && rest.length > 0 && (
                <div className="mb-2">
                  {(recents.length > 0 || recommended.length > 0) && (
                    <h3 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                      All personas
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rest.map((p, i) => (
                      <PersonaCard
                        key={p.id}
                        persona={p}
                        selected={false}
                        index={i}
                        onSelect={handlePersonaPick}
                        starred={defaultPersonas[(p.type ?? "chat") === "dashboard" ? "dashboard" : "chat"] === p.id}
                        onToggleStar={handleToggleStar}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No search results */}
              {personasFetched &&
                searchQuery.trim() &&
                recents.length === 0 &&
                recommended.length === 0 &&
                rest.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-dashed border-border-main bg-surface p-10 text-center"
                  >
                    <p className="text-sm font-medium text-text-main">
                      No personas match “{searchQuery}”
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-3 inline-flex items-center rounded-full border border-border-main bg-background px-3 py-1.5 text-xs font-medium text-text-main transition-colors hover:border-primary"
                    >
                      Clear search
                    </button>
                  </motion.div>
                )}

              {/* Empty mode */}
              {personasFetched &&
                modePersonas.length === 0 &&
                !searchQuery.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-dashed border-border-main bg-surface p-10 text-center"
                  >
                    <p className="text-sm font-medium text-text-main">
                      No {newChatType === "analytical" ? "chat" : "dashboard"} personas yet
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Try the other workspace, or contact your administrator.
                    </p>
                  </motion.div>
                )}

            </motion.section>
          )}

        </AnimatePresence>

        {/* Personas still loading */}
        {!isLoadingProfile && !personasFetched && !showEmptyState && !showPersonaPicker && (
          <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-3 rounded-full border border-border-main bg-surface px-5 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-text-muted">
              Loading personas…
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
