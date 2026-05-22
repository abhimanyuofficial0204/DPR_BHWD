# sop_config.py
# Configuration dictionary storing Phase 2 SOP targets

PHASE_2_SOP = {
    'ENZYME_RXN': {
        'target_conversion_LM_to_MA': (65.0, 100.0), # > 65%
        'target_weight_increase': 8.0               # ~8%
    },
    'SRP': {
        'target_heptane_loss': (0.0, 12.0),          # < 12%
        'target_process_time_hours': (5.0, 7.0)     # 6 ± 1 hr
    },
    'DISTILLATION': {
        'target_process_loss': (0.4, 0.8),          # 0.6 ± 0.2%
        'target_MAI_MA_content': (54.0, 56.0)       # ~55% MA content
    }
}
