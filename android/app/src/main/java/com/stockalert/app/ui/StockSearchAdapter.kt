package com.stockalert.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.stockalert.app.R
import com.stockalert.app.model.Stock

class StockSearchAdapter(
    private val onAdd: (Stock) -> Unit
) : RecyclerView.Adapter<StockSearchAdapter.ViewHolder>() {

    private var items: List<Stock> = emptyList()

    fun submitList(newItems: List<Stock>) {
        items = newItems
        notifyDataSetChanged()
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val symbol: TextView = view.findViewById(R.id.textSymbol)
        val name: TextView = view.findViewById(R.id.textName)
        val addButton: View = view.findViewById(R.id.buttonAdd)
    }

    override fun onCreateViewHolder(parent: ViewGroup, position: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_stock_search, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val stock = items[position]
        holder.symbol.text = "${stock.tradingsymbol} (${stock.exchange})"
        holder.name.text = stock.name ?: ""
        holder.addButton.setOnClickListener { onAdd(stock) }
    }

    override fun getItemCount() = items.size
}
