package com.autoflex.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Orange = Color(0xFFFF6A2A)
private val Amber = Color(0xFFFFB020)
private val DarkColors = darkColorScheme(
    primary = Orange,
    secondary = Amber,
    background = Color(0xFF0D1117),
    surface = Color(0xFF161B22),
    surfaceVariant = Color(0xFF1C2330),
    outline = Color(0xFF354052),
)
private val LightColors = lightColorScheme(primary = Color(0xFFC53B00), secondary = Color(0xFF7A5700))

@Composable
fun AutoflexTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors, content = content)
}
