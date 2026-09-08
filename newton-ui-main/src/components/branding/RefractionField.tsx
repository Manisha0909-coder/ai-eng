export function RefractionField() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full opacity-40 dark:opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--color-primary) / 0.35), transparent 70%)",
          animation: "drift-a 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-40 -right-28 w-[38rem] h-[38rem] rounded-full opacity-35 dark:opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--color-accent) / 0.30), transparent 70%)",
          animation: "drift-b 22s ease-in-out infinite",
        }}
      />
    </div>
  );
}
