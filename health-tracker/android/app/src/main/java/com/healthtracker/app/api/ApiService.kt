package com.healthtracker.app.api

import com.healthtracker.app.model.FoodLogEntry
import com.healthtracker.app.model.FoodLogResponse
import com.healthtracker.app.model.StepsResponse
import com.healthtracker.app.model.StepsSyncRequest
import com.healthtracker.app.model.TextLogRequest
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("food/log/text")
    suspend fun logFoodText(@Body request: TextLogRequest): FoodLogEntry

    @Multipart
    @POST("food/log/photo")
    suspend fun logFoodPhoto(
        @Part("device_token") deviceToken: RequestBody,
        @Part("log_date") logDate: RequestBody,
        @Part("note") note: RequestBody?,
        @Part image: MultipartBody.Part
    ): FoodLogEntry

    @GET("food/log")
    suspend fun getFoodLog(@Query("device_token") deviceToken: String, @Query("date") date: String): FoodLogResponse

    @DELETE("food/log/{id}")
    suspend fun deleteFoodLog(@Path("id") id: Long)

    @POST("steps/sync")
    suspend fun syncSteps(@Body request: StepsSyncRequest)

    @GET("steps")
    suspend fun getSteps(@Query("device_token") deviceToken: String, @Query("date") date: String): StepsResponse
}
