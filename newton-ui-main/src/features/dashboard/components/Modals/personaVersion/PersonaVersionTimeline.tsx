import type { Persona } from '@/services/rbac/rbacApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PersonaVersionTimelineProps {
  versions: Persona[];
  selectedId: number | undefined;
  effectiveCurrentId: number | undefined;
  loading?: boolean;
  onSelect: (version: Persona) => void;
  className?: string;
}

function getVersionLabel(version: Persona): string {
  return version.version != null ? `v${version.version}` : `#${version.id}`;
}

function VersionOptionLabel({
  version,
  isLive,
}: {
  version: Persona;
  isLive: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      {isLive && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          aria-hidden
        />
      )}
      <span className="tabular-nums">{getVersionLabel(version)}</span>
      {isLive && (
        <span className="text-2xs font-semibold uppercase tracking-wide text-primary">
          Live
        </span>
      )}
    </span>
  );
}

export function PersonaVersionTimeline({
  versions,
  selectedId,
  effectiveCurrentId,
  loading,
  onSelect,
  className,
}: PersonaVersionTimelineProps) {
  const selectedVersion = versions.find((v) => v.id === selectedId);
  const selectedValue = selectedId != null ? String(selectedId) : undefined;

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger
          className={cn(
            'h-9 w-full max-w-[200px] border-border-main bg-surface text-text-muted',
            className
          )}
        >
          <SelectValue placeholder="Loading versions…" />
        </SelectTrigger>
      </Select>
    );
  }

  if (versions.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger
          className={cn(
            'h-9 w-full max-w-[200px] border-border-main bg-surface text-text-muted',
            className
          )}
        >
          <SelectValue placeholder="No versions yet" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={selectedValue}
      onValueChange={(value) => {
        const version = versions.find((v) => v.id === Number(value));
        if (version) onSelect(version);
      }}
    >
      <SelectTrigger
        aria-label="Persona version"
        className={cn(
          'h-9 w-full max-w-[220px] border-border-main bg-surface text-text-main shadow-none focus:ring-primary/30',
          className
        )}
      >
        <SelectValue placeholder="Select version">
          {selectedVersion ? (
            <VersionOptionLabel
              version={selectedVersion}
              isLive={selectedVersion.id === effectiveCurrentId}
            />
          ) : (
            'Select version'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="border-border-main bg-surface text-text-main">
        {versions.map((version) => (
          <SelectItem
            key={version.id}
            value={String(version.id)}
            className="focus:bg-background/80"
          >
            <VersionOptionLabel
              version={version}
              isLive={version.id === effectiveCurrentId}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
