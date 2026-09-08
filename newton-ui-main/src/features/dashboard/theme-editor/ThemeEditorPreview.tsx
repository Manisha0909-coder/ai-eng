import { cn } from "@/lib/utils";
import { cardDefault, cardElevated, cardElevatedGradientBar } from "@/lib/card-styles";
import { DashboardPill } from "../components/DashboardPill";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles } from "lucide-react";

export function ThemeEditorPreview() {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto [scrollbar-width:thin]">
      {/* Typography */}
      <div className={cn(cardDefault, "p-4 space-y-1.5")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Typography</p>
        <h2 className="font-display text-[length:var(--font-size-2xl)] font-bold text-text-main leading-tight">
          Heading Display
        </h2>
        <p className="font-sans text-[length:var(--font-size-base)] text-text-main leading-relaxed">
          Body text in Instrument Sans. The quick brown fox jumps over the lazy dog.
        </p>
        <p className="font-mono text-[length:var(--font-size-sm)] text-text-muted">
          const mono = "Spline Sans Mono";
        </p>
      </div>

      {/* Buttons */}
      <div className={cn(cardDefault, "p-4 space-y-2")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Buttons</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="secondary">Secondary</Button>
          <Button size="sm" variant="outline">Outline</Button>
          <Button size="sm" variant="ghost">Ghost</Button>
          <Button size="sm" variant="destructive">Destructive</Button>
        </div>
      </div>

      {/* Entity pills */}
      <div className={cn(cardDefault, "p-4 space-y-2")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Entity pills</p>
        <div className="flex flex-wrap gap-2">
          <DashboardPill intent="entity" entity="role" label="Role" />
          <DashboardPill intent="entity" entity="persona" label="Persona" />
          <DashboardPill intent="entity" entity="doc-tag" label="Doc tag" />
          <DashboardPill intent="entity" entity="tool-tag" label="Tool tag" />
          <DashboardPill intent="entity" entity="server" label="Server" />
          <DashboardPill intent="entity" entity="datasource" label="Datasource" />
        </div>
      </div>

      {/* Status pills */}
      <div className={cn(cardDefault, "p-4 space-y-2")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Status pills</p>
        <div className="flex flex-wrap gap-2">
          <DashboardPill intent="status" status="success" label="Success" />
          <DashboardPill intent="status" status="error" label="Error" />
          <DashboardPill intent="status" status="warning" label="Warning" />
          <DashboardPill intent="status" status="info" label="Info" />
          <DashboardPill intent="status" status="pending" label="Pending" />
          <DashboardPill intent="neutral" label="Neutral" />
        </div>
      </div>

      {/* Chat bubbles */}
      <div className={cn(cardDefault, "p-4 space-y-3")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Chat messages</p>
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary/10 border border-primary/20 px-3 py-2 text-[length:var(--font-size-sm)] text-text-main">
            How do I configure the theme?
          </div>
        </div>
        {/* Assistant message */}
        <div className="flex gap-2 items-start">
          <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Sparkles size={13} className="text-primary" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-surface border border-border-main px-3 py-2 text-[length:var(--font-size-sm)] text-text-main">
            Use the Theme Editor tab to live-edit CSS tokens and export a <code className="font-mono bg-surface-2 px-1 rounded">theme.css</code> for deployment.
          </div>
        </div>
      </div>

      {/* Toast mock */}
      <div className={cn(cardDefault, "p-4 space-y-2")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Toast</p>
        <div className="flex gap-3 items-start rounded-lg border border-border-main bg-background px-3 py-2.5 shadow-md max-w-[280px]">
          <MessageSquare size={15} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[length:var(--font-size-sm)] font-medium text-text-main">Theme exported!</p>
            <p className="text-[length:var(--font-size-sm)] text-text-muted">theme.css downloaded.</p>
          </div>
        </div>
      </div>

      {/* Card variants */}
      <div className="space-y-2">
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Cards</p>
        <div className={cn(cardElevated, "p-4")}>
          <div className={cardElevatedGradientBar} />
          <p className="mt-3 text-[length:var(--font-size-sm)] font-semibold text-text-main">Elevated card</p>
          <p className="text-[length:var(--font-size-sm)] text-text-muted mt-0.5">With gradient accent bar</p>
        </div>
        <div className={cn(cardDefault, "p-4")}>
          <p className="text-[length:var(--font-size-sm)] font-semibold text-text-main">Default card</p>
          <p className="text-[length:var(--font-size-sm)] text-text-muted mt-0.5">Standard surface with border</p>
        </div>
      </div>

      {/* Color swatches */}
      <div className={cn(cardDefault, "p-4 space-y-2")}>
        <p className="text-[length:var(--font-size-sm)] text-text-muted uppercase tracking-widest font-semibold">Palette</p>
        <div className="grid grid-cols-5 gap-1.5">
          {(["primary", "secondary", "accent", "surface", "surface-2", "background", "text-main", "text-muted", "border-main", "input-bg"] as const).map((name) => (
            <div key={name} className="flex flex-col gap-1 items-center">
              <div
                className={`h-8 w-full rounded-md border border-border-main/50 bg-${name}`}
              />
              <span className="text-[9px] text-text-muted leading-none text-center truncate w-full">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
