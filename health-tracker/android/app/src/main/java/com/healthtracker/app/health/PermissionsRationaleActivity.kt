package com.healthtracker.app.health

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

// Health Connect requires an activity it can launch to explain, in plain
// language, why the app wants read access to step data. It has no other
// purpose than displaying that explanation.
class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = TextView(this).apply {
            text = "Health Tracker reads your daily step count from Health Connect " +
                "so it can show it alongside your food log. Step data is stored only " +
                "on this phone's backend and is never shared with third parties."
            setPadding(48, 96, 48, 48)
            textSize = 16f
        }
        setContentView(text)
    }
}
