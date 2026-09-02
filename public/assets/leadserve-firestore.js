(function () {
    function patchFirestore() {
        if (!window.firebase || !firebase.firestore || !window.initOMSFirestore || firebase.__leadserveFirestorePatched) return;

        const originalFirestore = firebase.firestore;
        const nativeFirestore = originalFirestore.bind(firebase);
        const patchedFirestore = function () {
            return window.initOMSFirestore(nativeFirestore());
        };

        Object.keys(originalFirestore).forEach(function (key) {
            patchedFirestore[key] = originalFirestore[key];
        });
        ["FieldValue", "Timestamp", "GeoPoint", "Blob", "CACHE_SIZE_UNLIMITED"].forEach(function (key) {
            if (originalFirestore[key]) patchedFirestore[key] = originalFirestore[key];
        });

        firebase.firestore = patchedFirestore;

        firebase.__leadserveFirestorePatched = true;
    }

    patchFirestore();
    window.addEventListener("load", patchFirestore);
})();
