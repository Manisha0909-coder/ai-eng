const shimmer =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-primary/8 before:to-transparent";

const SkeletonBlock = ({
  className,
}: {
  className: string;
}) => (
  <div className={`rounded-lg bg-surface-2 ${shimmer} ${className}`} />
);

const UserMessageSkeleton = ({ wide }: { wide?: boolean }) => (
  <div className="flex justify-end">
    <div
      className={`rounded-2xl rounded-tr-sm bg-primary/8 border border-primary/15 px-4 py-3 ${wide ? "w-72" : "w-52"} ${shimmer}`}
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-3.5 w-full" />
        {wide && <SkeletonBlock className="h-3.5 w-4/5" />}
      </div>
    </div>
  </div>
);

const AssistantMessageSkeleton = ({
  lines,
}: {
  lines: number[];
}) => (
  <div className="flex gap-3">
    <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-primary/15" />
    <div className="flex-1 space-y-2 pt-1">
      {lines.map((w, i) => (
        <SkeletonBlock key={i} className={`h-3.5`} style={{ width: `${w}%` } as React.CSSProperties} />
      ))}
    </div>
  </div>
);

const LoadingChatSkeleton = () => (
  <div className="mx-auto max-w-2xl space-y-8 px-2 py-6 sm:px-4">
    <UserMessageSkeleton />
    <AssistantMessageSkeleton lines={[90, 75, 82, 55]} />
    <UserMessageSkeleton wide />
    <AssistantMessageSkeleton lines={[85, 68, 78]} />
    <UserMessageSkeleton />
    <AssistantMessageSkeleton lines={[72, 88, 60]} />
  </div>
);

export default LoadingChatSkeleton;
