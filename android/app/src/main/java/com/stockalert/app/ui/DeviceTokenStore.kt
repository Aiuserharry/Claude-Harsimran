package com.stockalert.app.ui

// Simple in-memory holder so the FCM service can hand a freshly-rotated
// token to whichever screen is active without a full event bus.
object DeviceTokenStore {
    var cachedToken: String? = null
}
