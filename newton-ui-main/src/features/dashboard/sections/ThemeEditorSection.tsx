import { useCallback, useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw, Sun, Moon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import notify from "@/utils/notify";
import { isDarkMode } from "@/utils/theme";
import {
  dashboardTabCardClassName,
  dashboardTabCardHeaderClassName,
  DashboardTabCardChrome,
  dashboardTabCardMotionVariants,
  dashboardTabHeaderMotionClassName,
  dashboardTabHeaderTitleColumnClassName,
  dashboardTabHeaderActionsColumnClassName,
  dashboardTabToolbarButtonLabelClassName,
} from "../components/DashboardTabLayout";
import { cardDefault } from "@/lib/card-styles";
import { motion } from "framer-motion";
import { CardDescription } from "@/components/ui/card";
import { useThemeEditor } from "../theme-editor/useThemeEditor";
import { ThemeEditorPreview } from "../theme-editor/ThemeEditorPreview";
import {
  TOKEN_SCHEMA,
  TOKEN_GROUPS,
  FONT_FAMILY_OPTIONS,
  type TokenDef,
} from "../theme-editor/tokenSchema";
import { tripletToHex, hexToTriplet } from "../theme-editor/themeDraft";
import { THEME_PRESETS, type ThemePreset } from "../theme-editor/themePresets";
import {
  getDefaultThemePresetId,
  setDefaultThemePreset,
  clearDefaultThemePreset,
} from "../theme-editor/defaultTheme";

export interface ThemeEditorSectionProps {
  isSuperAdmin: boolean;
  activeTab: string;
}

// ---- per-token control ----

interface TokenControlProps {
  token: TokenDef;
  value: string;
  onChange: (value: string) => void;
}

function TokenControl({ token, value, onChange }: TokenControlProps) {
  if (token.kind === "color") {
    const hex = tripletToHex(value || "0 0 0");
    return (
      <div className="flex items-center gap-2 min-w-0">
        <label
          className="relative h-7 w-7 shrink-0 cursor-pointer rounded overflow-hidden border border-border-main"
          title={token.label}
        >
          <input
            type="color"
            value={hex}
            className="absolute -inset-1 h-[200%] w-[200%] cursor-pointer opacity-0"
            onChange={(e) => onChange(hexToTriplet(e.target.value))}
          />
          <div
            className="h-full w-full"
            style={{ backgroundColor: `rgb(${(value || "0 0 0").split(" ").join(",")})` }}
          />
        </label>
        <Input
          className="h-7 font-mono text-xs w-full min-w-0"
          value={value}
          placeholder="R G B"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (token.kind === "alpha") {
    const num = parseFloat(value) || 0;
    return (
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={num}
          className="flex-1 accent-primary h-1.5"
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          className="h-7 w-16 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (token.kind === "fontFamily") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs w-full font-sans">
          <SelectValue placeholder="Pick font…" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value={value} className="text-xs italic text-text-muted">
            Custom
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // length, fontSize, shadow, duration, easing — plain text input
  return (
    <Input
      className="h-7 font-mono text-xs w-full min-w-0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ---- preset picker ----

interface ThemePresetPickerProps {
  activeMode: "light" | "dark";
  onApply: (preset: ThemePreset) => void;
}

function ThemePresetPicker({ activeMode, onApply }: ThemePresetPickerProps) {
  const [defaultId, setDefaultId] = useState<string | null>(() =>
    getDefaultThemePresetId()
  );

  const handleToggleDefault = useCallback(
    (preset: ThemePreset) => {
      if (defaultId === preset.id) {
        clearDefaultThemePreset();
        setDefaultId(null);
        notify.success("Default theme cleared");
        return;
      }
      setDefaultThemePreset(preset.id);
      setDefaultId(preset.id);
      notify.success(`${preset.name} set as the default theme`);
    },
    [defaultId]
  );

  const defaultPreset = THEME_PRESETS.find((p) => p.id === defaultId);

  return (
    <div className={cn(cardDefault, "p-3 space-y-2.5")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Presets
        </p>
        <p className="text-[10px] text-text-muted truncate">
          {defaultPreset ? (
            <>
              Default: <span className="font-semibold text-text-main">{defaultPreset.name}</span>
            </>
          ) : (
            "Star a preset to make it the default"
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {THEME_PRESETS.map((preset) => {
          const swatch = activeMode === "dark" ? preset.swatchDark : preset.swatchLight;
          const isDefault = preset.id === defaultId;
          return (
            <div
              key={preset.id}
              className={cn(
                "group flex items-center gap-1.5 rounded-lg border bg-surface pl-3 pr-1.5 py-2",
                "transition-all duration-150 hover:bg-surface-2 hover:shadow-sm",
                isDefault
                  ? "border-primary/60 shadow-sm"
                  : "border-border-main hover:border-primary/50",
              )}
            >
              <button
                type="button"
                onClick={() => onApply(preset)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 text-left rounded-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                )}
                title={`Apply ${preset.name}`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: swatch }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-main leading-none">{preset.name}</p>
                  <p className="text-[10px] text-text-muted leading-snug mt-0.5 truncate">{preset.description}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleDefault(preset)}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isDefault ? "text-primary" : "text-text-muted/60 hover:text-primary",
                )}
                title={isDefault ? "Clear default theme" : `Set ${preset.name} as default`}
                aria-label={isDefault ? "Clear default theme" : `Set ${preset.name} as default`}
                aria-pressed={isDefault}
              >
                <Star size={14} className={isDefault ? "fill-current" : undefined} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- group panel ----

interface GroupPanelProps {
  group: string;
  tokens: TokenDef[];
  draft: Record<string, string>;
  onSet: (cssVar: string, value: string) => void;
}

function GroupPanel({ group, tokens, draft, onSet }: GroupPanelProps) {
  return (
    <div className={cn(cardDefault, "p-3 space-y-2")}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {group}
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
        {tokens.map((token) => (
          <div key={`${token.cssVar}-${token.mode}`} className="grid gap-1" style={{ gridTemplateColumns: "120px minmax(0,1fr)" }}>
            <span className="text-xs text-text-muted self-center truncate" title={token.cssVar}>
              {token.label}
            </span>
            <TokenControl
              token={token}
              value={draft[token.cssVar] ?? ""}
              onChange={(v) => onSet(token.cssVar, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- inner editor (hook lives here, outside guard) ----

function ThemeEditorInner({ activeTab }: { activeTab: string }) {
  const { draft, currentMode, setToken, reset, applyPreset, exportCss, isModified } = useThemeEditor();

  const handleReset = useCallback(() => {
    reset();
    notify.success("Theme reset to defaults");
  }, [reset]);

  const handleExport = useCallback(() => {
    exportCss();
    notify.success("theme.css downloaded");
  }, [exportCss]);

  // Build per-mode token maps for display
  const modeDraft = currentMode === "light" ? draft.light : draft.dark;

  // Group tokens by group and filter to the current active mode (+ shared)
  const groupedTokens: Record<string, { token: TokenDef; map: Record<string, string> }[]> = {};

  for (const group of TOKEN_GROUPS) {
    groupedTokens[group] = [];
    for (const token of TOKEN_SCHEMA) {
      if (token.group !== group) continue;
      if (token.mode === "light" && currentMode !== "light") continue;
      if (token.mode === "dark" && currentMode !== "dark") continue;
      const map = token.mode === "shared" ? draft.shared : modeDraft;
      groupedTokens[group].push({ token, map });
    }
  }

  return (
    <TabsContent
      value="theme-editor"
      className="mt-6 h-full w-full flex-1 overflow-hidden min-h-0"
    >
      <Card className={cn(dashboardTabCardClassName, activeTab === "theme-editor" ? "" : "hidden")}>
        <DashboardTabCardChrome />

        {/* Header */}
        <CardHeader className={dashboardTabCardHeaderClassName}>
          <motion.div
            className={dashboardTabHeaderMotionClassName}
            variants={dashboardTabCardMotionVariants}
            initial="hidden"
            animate="visible"
          >
            <div className={dashboardTabHeaderTitleColumnClassName}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <CardTitle className="text-text-main text-xl sm:text-2xl flex items-center gap-2">
                  Theme Editor
                  {isModified && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                      Modified
                    </span>
                  )}
                </CardTitle>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <CardDescription className="text-text-muted text-sm">
                  Live-edit CSS tokens — changes apply to the entire app instantly.
                </CardDescription>
              </motion.div>
            </div>

            <motion.div
              className={dashboardTabHeaderActionsColumnClassName}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {/* Mode indicator */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border-main bg-surface px-3 py-1.5 text-xs text-text-muted">
                {currentMode === "dark" ? (
                  <Moon size={13} className="text-primary" />
                ) : (
                  <Sun size={13} className="text-primary" />
                )}
                Editing <span className="font-semibold text-text-main capitalize">{currentMode}</span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                disabled={!isModified}
              >
                <RotateCcw size={14} />
                <span className={dashboardTabToolbarButtonLabelClassName}>Reset</span>
              </Button>

              <Button size="sm" onClick={handleExport}>
                <Download size={14} />
                <span className={dashboardTabToolbarButtonLabelClassName}>Download theme.css</span>
              </Button>
            </motion.div>
          </motion.div>
        </CardHeader>

        {/* Body: two-column layout */}
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
          <div className="flex h-full min-h-0 gap-0 divide-x divide-border-main/50">
            {/* Left: token controls */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 space-y-4 [scrollbar-width:thin]">
              <ThemePresetPicker activeMode={currentMode} onApply={applyPreset} />
              {TOKEN_GROUPS.map((group) => {
                const items = groupedTokens[group];
                if (!items || items.length === 0) return null;
                return (
                  <GroupPanel
                    key={group}
                    group={group}
                    tokens={items.map((i) => i.token)}
                    draft={items[0].map}
                    onSet={(cssVar, value) => {
                      const mode = items.find((i) => i.token.cssVar === cssVar)?.token.mode ?? "shared";
                      setToken(mode, cssVar, value);
                    }}
                  />
                );
              })}
            </div>

            {/* Right: live preview */}
            <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-2 [scrollbar-width:thin] hidden lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">
                Live preview
              </p>
              <ThemeEditorPreview />
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// ---- public export ----

export function ThemeEditorSection({
  isSuperAdmin,
  activeTab,
}: Readonly<ThemeEditorSectionProps>) {
  if (!isSuperAdmin) {
    return (
      <TabsContent value="theme-editor" className="mt-0">
        <Card className={dashboardTabCardClassName}>
          <DashboardTabCardChrome />
          <CardHeader className={dashboardTabCardHeaderClassName}>
            <CardTitle className="text-text-main">Access Denied</CardTitle>
            <CardDescription>This section is only available to super admins.</CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    );
  }
  return <ThemeEditorInner activeTab={activeTab} />;
}
