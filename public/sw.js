self.addEventListener('push', (event) => {
  let data = { title: 'UCSSACCO Boardpack', body: 'New notification' };
  try { data = event.data ? event.data.json() : data; } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'UCSSACCO Boardpack', {
    body: data.body || '',
    icon: '/favicon.ico',
    data: { url: data.url || '/notifications' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => w.url === url);
      return existing ? existing.focus() : clients.openWindow(url);
    }),
  );
});
