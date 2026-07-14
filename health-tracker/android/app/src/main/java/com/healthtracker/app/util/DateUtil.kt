package com.healthtracker.app.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter

object DateUtil {
    private val FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE

    fun today(): String = LocalDate.now().format(FORMATTER)
}
