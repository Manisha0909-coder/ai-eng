/*
 * Web Push handlers, layered onto the generated Workbox service worker via
 * `workbox.importScripts` (see src/pwa/pwaOptions.ts). Keep this file to
 * `push` / `notificationclick` listeners only — app-shell caching and
 * navigation behavior belong to the generated worker.
 *
 * Payload contract (backend push_service.send_to_user):
 *   { "title": "⏰ Reminder", "body": "...", "url": "/chat/<session_id>" }
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Newton";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192x192.png",
    // Android status-bar glyph: must be a white-on-transparent silhouette —
    // a colored icon here renders as a plain white square.
    badge: "/icons/badge-96.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab if one is open, navigating it to the chat.
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && targetUrl !== "/") {
              return client.navigate(targetUrl).catch(() => undefined);
            }
            return undefined;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
