package com.stockalert.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.stockalert.app.R
import com.stockalert.app.model.WatchlistItem

class WatchlistAdapter(
    private val onEditLimit: (WatchlistItem) -> Unit,
    private val onRemove: (WatchlistItem) -> Unit
) : RecyclerView.Adapter<WatchlistAdapter.ViewHolder>() {

    private var items: List<WatchlistItem> = emptyList()

    fun submitList(newItems: List<WatchlistItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val symbol: TextView = view.findViewById(R.id.textSymbol)
        val limit: TextView = view.findViewById(R.id.textLimit)
        val editButton: View = view.findViewById(R.id.buttonEdit)
        val removeButton: View = view.findViewById(R.id.buttonRemove)
    }

    override fun onCreateViewHolder(parent: ViewGroup, position: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_watchlist, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.symbol.text = "${item.tradingsymbol} (${item.exchange})"
        val directionWord = if (item.direction == "above") "above" else "below"
        holder.limit.text = "Alert when price goes $directionWord ₹${item.limit_price}"
        holder.editButton.setOnClickListener { onEditLimit(item) }
        holder.removeButton.setOnClickListener { onRemove(item) }
    }

    override fun getItemCount() = items.size
}
