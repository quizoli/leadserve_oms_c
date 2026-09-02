const firebaseConfig=(window.OMS_CONFIG&&window.OMS_CONFIG.firebase)||{};firebase.initializeApp(firebaseConfig);const db=firebase.firestore();
