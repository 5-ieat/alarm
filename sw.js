// sw.js (サービスワーカー)

const DB_NAME = "AlarmMediaDB";
const STORE_NAME = "mediaFiles";

// 💡 IndexedDBから音楽ファイル（Blob）を取得する関数
function getMediaFromDB(index) {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) return resolve(null);
            
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(`media_${index}`);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
    });
}

// 💡 サーバーからプッシュ通知（アラームの合図）を受信したときの処理
self.addEventListener('push', function(event) {
    // サーバーから「何番のアラームか」のデータが送られてくると仮定（例: index = 0）
    const alarmIndex = 0; 

    // 通知の表示設定
    const title = "⏰ アラームの時間です！";
    const options = {
        body: "画面をタップしてアラームを停止してください。",
        icon: "icon.png",
        tag: "pwa-alarm", // 重複を防ぐためのタグ
        renotify: true,
        requireInteraction: true // ユーザーが消すまで通知を出しっぱなしにする
    };

    // 1. 通知を表示する
    const notificationPromise = self.registration.showNotification(title, options);

    // 2. 裏でIndexedDBから音源を取得して再生を仕込む処理
    const audioPromise = getMediaFromDB(alarmIndex).then(async (fileBlob) => {
        if (!fileBlob) return;

        // 現在開いているアプリの画面（ウィンドウ）を探す
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        
        if (clientList.length > 0) {
            // アプリが裏で開いているなら、その画面に「音を鳴らせ」とデータを送る
            clientList[0].postMessage({ type: 'PLAY_ALARM', blob: fileBlob });
            clientList[0].focus();
        } else {
            // 💡 アプリが完全に閉じている場合、裏で一瞬だけ「音鳴らし専用の隠しページ」を開く
            // （※実務では、audio.html などの音を鳴らすためだけの軽量なHTMLを1枚用意します）
            const newClient = await self.clients.openWindow('/audio.html');
            // 開いたページが準備できたら、メッセージで音源を送りつけて再生させる
            setTimeout(() => {
                newClient.postMessage({ type: 'PLAY_ALARM', blob: fileBlob });
            }, 1000);
        }
    });

    // すべてのバックグラウンド処理（通知表示・音源準備）が完了するまでサービスワーカーを維持する
    event.waitUntil(Promise.all([notificationPromise, audioPromise]));
});

self.registration.showNotification('アラーム', {
    body: 'アラームです！アプリを開いてアラームを消そう！',
    vibrate: [200, 100, 200] // スマホをブブッと震わせる設定
});
