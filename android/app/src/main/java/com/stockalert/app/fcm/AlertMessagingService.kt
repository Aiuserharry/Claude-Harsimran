package com.stockalert.app.fcm

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.stockalert.app.R
import com.stockalert.app.ui.MainActivity
import kotlin.random.Random

class AlertMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: "Price alert"
        val body = message.notification?.body ?: ""

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, "price_alerts")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(this).notify(Random.nextInt(), notification)
    }

    // Called whenever a new FCM token is issued (first install, app data
    // cleared, etc). MainActivity re-registers it with the backend on launch
    // too, so this just keeps things in sync if the token rotates later.
    override fun onNewToken(token: String) {
        com.stockalert.app.ui.DeviceTokenStore.cachedToken = token
    }
}
