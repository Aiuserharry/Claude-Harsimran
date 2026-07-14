package com.healthtracker.app.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.healthtracker.app.databinding.ItemFoodLogBinding
import com.healthtracker.app.model.FoodLogEntry

class FoodLogAdapter(private var entries: List<FoodLogEntry>) :
    RecyclerView.Adapter<FoodLogAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemFoodLogBinding) : RecyclerView.ViewHolder(binding.root)

    fun submitList(newEntries: List<FoodLogEntry>) {
        entries = newEntries
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemFoodLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = entries[position]
        holder.binding.textDescription.text = entry.description
        holder.binding.textCalories.text = "${entry.calories} kcal"
        val sourceLabel = when (entry.source) {
            "photo" -> "via photo"
            "voice" -> "via voice"
            else -> "via text"
        }
        holder.binding.textMacros.text = "Protein ${entry.protein_g.toInt()}g · " +
            "Carbs ${entry.carbs_g.toInt()}g · Fat ${entry.fat_g.toInt()}g · $sourceLabel"
    }

    override fun getItemCount(): Int = entries.size
}
