package com.stockalert.app.ui

import android.os.Build
import android.os.Bundle
import android.widget.RadioGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.addTextChangedListener
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.messaging.FirebaseMessaging
import com.stockalert.app.R
import com.stockalert.app.api.ApiClient
import com.stockalert.app.databinding.ActivityMainBinding
import com.stockalert.app.model.AddWatchlistRequest
import com.stockalert.app.model.RegisterDeviceRequest
import com.stockalert.app.model.Stock
import com.stockalert.app.model.UpdateWatchlistRequest
import com.stockalert.app.model.WatchlistItem
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var searchAdapter: StockSearchAdapter
    private lateinit var watchlistAdapter: WatchlistAdapter
    private var deviceToken: String? = null

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        searchAdapter = StockSearchAdapter(onAdd = { addStockToWatchlist(it) })
        binding.recyclerSearchResults.adapter = searchAdapter

        watchlistAdapter = WatchlistAdapter(
            onEditLimit = { showLimitDialog(it) },
            onRemove = { removeFromWatchlist(it) }
        )
        binding.recyclerWatchlist.adapter = watchlistAdapter

        binding.inputSearch.addTextChangedListener { text ->
            val query = text?.toString().orEmpty()
            if (query.length >= 2) searchStocks(query) else searchAdapter.submitList(emptyList())
        }

        registerDeviceAndLoadWatchlist()
    }

    private fun registerDeviceAndLoadWatchlist() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            deviceToken = token
            lifecycleScope.launch {
                try {
                    ApiClient.service.registerDevice(RegisterDeviceRequest(token))
                    loadWatchlist()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Could not reach server: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun searchStocks(query: String) {
        lifecycleScope.launch {
            try {
                val results = ApiClient.service.searchStocks(query)
                searchAdapter.submitList(results)
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Search failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadWatchlist() {
        val token = deviceToken ?: return
        lifecycleScope.launch {
            try {
                val items = ApiClient.service.getWatchlist(token)
                watchlistAdapter.submitList(items)
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Could not load watchlist: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun addStockToWatchlist(stock: Stock) {
        val token = deviceToken ?: run {
            Toast.makeText(this, "Still connecting, try again in a moment", Toast.LENGTH_SHORT).show()
            return
        }
        promptForLimit(title = "Set alert for ${stock.tradingsymbol}") { limitPrice, direction ->
            lifecycleScope.launch {
                try {
                    ApiClient.service.addToWatchlist(
                        AddWatchlistRequest(
                            device_token = token,
                            instrument_token = stock.instrument_token,
                            tradingsymbol = stock.tradingsymbol,
                            exchange = stock.exchange,
                            limit_price = limitPrice,
                            direction = direction
                        )
                    )
                    loadWatchlist()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Could not add stock: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showLimitDialog(item: WatchlistItem) {
        promptForLimit(
            title = "Edit alert for ${item.tradingsymbol}",
            initialPrice = item.limit_price,
            initialDirection = item.direction
        ) { limitPrice, direction ->
            lifecycleScope.launch {
                try {
                    ApiClient.service.updateWatchlist(item.id, UpdateWatchlistRequest(limitPrice, direction))
                    loadWatchlist()
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Could not update: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun removeFromWatchlist(item: WatchlistItem) {
        lifecycleScope.launch {
            try {
                ApiClient.service.removeFromWatchlist(item.id)
                loadWatchlist()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Could not remove: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun promptForLimit(
        title: String,
        initialPrice: Double? = null,
        initialDirection: String = "below",
        onConfirm: (Double, String) -> Unit
    ) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_set_limit, null)
        val priceInput = dialogView.findViewById<TextInputEditText>(R.id.inputLimitPrice)
        val radioGroup = dialogView.findViewById<RadioGroup>(R.id.radioGroupDirection)

        initialPrice?.let { priceInput.setText(it.toString()) }
        if (initialDirection == "above") radioGroup.check(R.id.radioAbove)

        AlertDialog.Builder(this)
            .setTitle(title)
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                val price = priceInput.text?.toString()?.toDoubleOrNull()
                if (price == null) {
                    Toast.makeText(this, "Enter a valid price", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                val direction = if (radioGroup.checkedRadioButtonId == R.id.radioAbove) "above" else "below"
                onConfirm(price, direction)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
