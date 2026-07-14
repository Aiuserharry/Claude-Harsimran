package com.healthtracker.app.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.ZoneId

// Wraps Health Connect: it's the on-device store that phone step sensors /
// Google Fit / Wear OS / Samsung Health etc. all write into, so reading from
// it covers most phones without needing a device-specific SDK.
class StepsManager(private val context: Context) {

    companion object {
        val READ_STEPS_PERMISSION: Set<String> = setOf(HealthPermission.getReadPermission(StepsRecord::class))

        fun isAvailable(context: Context): Boolean =
            HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

        fun permissionRequestContract() = PermissionController.createRequestPermissionResultContract()
    }

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun hasStepsPermission(): Boolean {
        val granted = client.permissionController.getGrantedPermissions()
        return granted.containsAll(READ_STEPS_PERMISSION)
    }

    suspend fun todaySteps(): Long {
        val zone = ZoneId.systemDefault()
        val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val now = java.time.Instant.now()
        val response: AggregationResult = client.aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
            )
        )
        return response[StepsRecord.COUNT_TOTAL] ?: 0L
    }
}
