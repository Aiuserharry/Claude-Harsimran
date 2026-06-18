package com.stockalert.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "price_alerts",
                "Price Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifies you when a watched stock crosses your set price limit"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
