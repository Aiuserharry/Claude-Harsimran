package com.healthtracker.app.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.healthtracker.app.api.ApiClient
import com.healthtracker.app.databinding.ActivityMainBinding
import com.healthtracker.app.databinding.DialogAddFoodTextBinding
import com.healthtracker.app.health.StepsManager
import com.healthtracker.app.model.StepsSyncRequest
import com.healthtracker.app.model.TextLogRequest
import com.healthtracker.app.util.DateUtil
import com.healthtracker.app.util.DeviceTokenStore
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var deviceToken: String
    private lateinit var stepsManager: StepsManager
    private val adapter = FoodLogAdapter(emptyList())
    private var pendingPhotoUri: Uri? = null
    private var pendingPhotoFile: File? = null

    private val takePhotoLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val file = pendingPhotoFile
        if (success && file != null) {
            promptNoteAndUploadPhoto(file)
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchCamera() else toast("Camera permission is needed to log food by photo")
    }

    private val speechLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val text = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
        if (!text.isNullOrBlank()) {
            logFoodText(text, source = "voice")
        }
    }

    private val healthPermissionLauncher = registerForActivityResult(StepsManager.permissionRequestContract()) {
        refreshSteps()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        deviceToken = DeviceTokenStore.get(this)
        stepsManager = StepsManager(this)

        binding.recyclerFoodLog.layoutManager = LinearLayoutManager(this)
        binding.recyclerFoodLog.adapter = adapter

        binding.buttonAddPhoto.setOnClickListener { onAddPhotoClicked() }
        binding.buttonAddVoice.setOnClickListener { onAddVoiceClicked() }
        binding.buttonAddText.setOnClickListener { onAddTextClicked() }

        refreshFoodLog()
        refreshSteps()
    }

    override fun onResume() {
        super.onResume()
        refreshFoodLog()
        refreshSteps()
    }

    // ---- Food log ----

    private fun refreshFoodLog() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.service.getFoodLog(deviceToken, DateUtil.today())
                adapter.submitList(response.entries)
                binding.textEmpty.visibility = if (response.entries.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
                binding.textCaloriesTotal.text = response.totals.calories.toString()
            } catch (e: Exception) {
                toast("Couldn't load today's food log: ${e.message}")
            }
        }
    }

    private fun onAddTextClicked() {
        val dialogBinding = DialogAddFoodTextBinding.inflate(layoutInflater)
        MaterialAlertDialogBuilder(this)
            .setTitle("Log food")
            .setView(dialogBinding.root)
            .setPositiveButton("Save") { _, _ ->
                val text = dialogBinding.editFoodDescription.text?.toString()?.trim()
                if (!text.isNullOrEmpty()) logFoodText(text, source = "text")
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun onAddVoiceClicked() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Describe what you ate")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            toast("Speech recognition isn't available on this device")
        }
    }

    private fun logFoodText(description: String, source: String) {
        lifecycleScope.launch {
            try {
                ApiClient.service.logFoodText(TextLogRequest(deviceToken, DateUtil.today(), description, source))
                refreshFoodLog()
            } catch (e: Exception) {
                toast("Couldn't log that: ${e.message}")
            }
        }
    }

    private fun onAddPhotoClicked() {
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchCamera()
        } else {
            cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
        }
    }

    private fun launchCamera() {
        val dir = File(cacheDir, "food_photos").apply { mkdirs() }
        val file = File(dir, "meal_${System.currentTimeMillis()}.jpg")
        pendingPhotoFile = file
        pendingPhotoUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        takePhotoLauncher.launch(pendingPhotoUri)
    }

    private fun promptNoteAndUploadPhoto(file: File) {
        val dialogBinding = DialogAddFoodTextBinding.inflate(layoutInflater)
        dialogBinding.editFoodDescription.hint = "Anything to add? (optional)"
        MaterialAlertDialogBuilder(this)
            .setTitle("Log food from photo")
            .setView(dialogBinding.root)
            .setPositiveButton("Save") { _, _ ->
                val note = dialogBinding.editFoodDescription.text?.toString()?.trim()
                uploadPhoto(file, note)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun uploadPhoto(file: File, note: String?) {
        lifecycleScope.launch {
            try {
                val imagePart = MultipartBody.Part.createFormData(
                    "image", file.name, file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                )
                ApiClient.service.logFoodPhoto(
                    deviceToken.toRequestBody("text/plain".toMediaTypeOrNull()),
                    DateUtil.today().toRequestBody("text/plain".toMediaTypeOrNull()),
                    note?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    imagePart
                )
                refreshFoodLog()
            } catch (e: Exception) {
                toast("Couldn't analyze that photo: ${e.message}")
            }
        }
    }

    // ---- Steps ----

    private fun refreshSteps() {
        if (!StepsManager.isAvailable(this)) {
            binding.textSteps.text = "N/A"
            return
        }
        lifecycleScope.launch {
            try {
                if (!stepsManager.hasStepsPermission()) {
                    healthPermissionLauncher.launch(StepsManager.READ_STEPS_PERMISSION)
                    return@launch
                }
                val steps = stepsManager.todaySteps()
                binding.textSteps.text = String.format("%,d", steps)
                ApiClient.service.syncSteps(StepsSyncRequest(deviceToken, DateUtil.today(), steps.toInt()))
            } catch (e: Exception) {
                binding.textSteps.text = "--"
            }
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}
