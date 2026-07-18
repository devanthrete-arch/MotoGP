package com.autoflex.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.autoflex.android.ui.AutoflexApp
import com.autoflex.android.ui.AutoflexTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AutoflexTheme {
                val viewModel: AutoflexViewModel = viewModel()
                val state by viewModel.state.collectAsStateWithLifecycle()
                BackHandler(enabled = state.editor != null || state.selectedPost != null) {
                    if (state.editor != null) viewModel.closeEditor() else viewModel.closePost()
                }
                AutoflexApp(state, viewModel)
            }
        }
    }
}
