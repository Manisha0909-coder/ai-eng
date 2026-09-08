import { cn } from '@/lib/utils';
import { personaDetailPanelClass } from '@/features/dashboard/utils/dashboardHelper';

interface RawPromptBlockProps {
  content: string;
  className?: string;
}

export function RawPromptBlock({ content, className }: RawPromptBlockProps) {
  return (
    <pre
      className={cn(
        personaDetailPanelClass,
        'overflow-x-auto p-3 text-xs font-mono leading-relaxed text-text-main whitespace-pre-wrap break-words',
        className
      )}
    >
      <code className="font-inherit text-inherit">{content}</code>
    </pre>
  );
}
