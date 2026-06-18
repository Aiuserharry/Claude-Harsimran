package com.stockalert.app.api

import com.stockalert.app.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @GET("stocks/search")
    suspend fun searchStocks(@Query("q") query: String): List<Stock>

    @POST("watchlist/devices")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): Response<Unit>

    @GET("watchlist")
    suspend fun getWatchlist(@Query("device_token") deviceToken: String): List<WatchlistItem>

    @POST("watchlist")
    suspend fun addToWatchlist(@Body body: AddWatchlistRequest): Response<Unit>

    @PATCH("watchlist/{id}")
    suspend fun updateWatchlist(@Path("id") id: Long, @Body body: UpdateWatchlistRequest): Response<Unit>

    @DELETE("watchlist/{id}")
    suspend fun removeFromWatchlist(@Path("id") id: Long): Response<Unit>
}
