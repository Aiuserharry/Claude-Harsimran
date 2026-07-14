package com.healthtracker.app.util

import android.content.Context
import java.util.UUID

// A random per-install ID, used only to separate one phone's log from
// another's on the backend. Not tied to any account or personal info.
object DeviceTokenStore {
    private const val PREFS = "health_tracker_prefs"
    private const val KEY_TOKEN = "device_token"

    fun get(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_TOKEN, null)
        if (existing != null) return existing
        val token = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_TOKEN, token).apply()
        return token
    }
}
