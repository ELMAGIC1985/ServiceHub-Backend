// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
firebase.initializeApp({
  apiKey: 'AIzaSyBkf07TZ_lA69j9LBAMcwOfOaXEdMZVUxI',
  authDomain: 'homescrew-b7b08.firebaseapp.com',
  projectId: 'homescrew-b7b08',
  storageBucket: 'homescrew-b7b08.firebasestorage.app',
  messagingSenderId: '351597022739',
  appId: '1:351597022739:web:87b4af5b45de99ec6b79e6',
});

// Initialize Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || 'Background Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png', // Optional icon
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
