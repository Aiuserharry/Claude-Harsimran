package com.stockalert.app.model

data class Stock(
    val instrument_token: Long,
    val tradingsymbol: String,
    val name: String?,
    val exchange: String
)

data class WatchlistItem(
    val id: Long,
    val device_token: String,
    val instrument_token: Long,
    val tradingsymbol: String,
    val exchange: String,
    val limit_price: Double,
    val direction: String // "below" or "above"
)

data class RegisterDeviceRequest(val device_token: String)

data class AddWatchlistRequest(
    val device_token: String,
    val instrument_token: Long,
    val tradingsymbol: String,
    val exchange: String,
    val limit_price: Double,
    val direction: String
)

data class UpdateWatchlistRequest(
    val limit_price: Double,
    val direction: String
)
