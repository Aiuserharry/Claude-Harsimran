package com.healthtracker.app.model

data class FoodLogEntry(
    val id: Long,
    val device_token: String,
    val log_date: String,
    val description: String,
    val calories: Int,
    val protein_g: Double,
    val carbs_g: Double,
    val fat_g: Double,
    val source: String,
    val created_at: String
)

data class FoodLogTotals(
    val calories: Int,
    val protein_g: Double,
    val carbs_g: Double,
    val fat_g: Double
)

data class FoodLogResponse(
    val entries: List<FoodLogEntry>,
    val totals: FoodLogTotals
)

data class TextLogRequest(
    val device_token: String,
    val log_date: String,
    val description: String,
    val source: String
)

data class StepsSyncRequest(
    val device_token: String,
    val log_date: String,
    val step_count: Int
)

data class StepsResponse(
    val step_count: Int,
    val updated_at: String?
)
