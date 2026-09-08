import { Button } from "@/components/ui/button";
import { FormField } from "./Forms/FormField";
import notify from "@/utils/notify";
import { Copy } from "lucide-react";

export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    notify.success("Copied");
  } catch {
    notify.error("Copy failed");
  }
}

export interface RedirectUriFieldProps {
  redirectUri: string;
  hint?: string;
}

/** Read-only, copyable display of the backend-computed OAuth redirect_uri (never authored by an admin). */
export function RedirectUriField({
  redirectUri,
  hint = "register this exact URL in the provider's app settings",
}: Readonly<RedirectUriFieldProps>) {
  return (
    <FormField label="Redirect URI" hint={hint}>
      <div className="flex items-center gap-2 rounded-lg border border-border-main bg-surface-2 px-3 py-2">
        <code className="font-mono text-2xs text-text-main truncate flex-1">{redirectUri}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-text-muted hover:text-text-main"
          onClick={() => copyToClipboard(redirectUri)}
          title="Copy redirect URI"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </FormField>
  );
}
