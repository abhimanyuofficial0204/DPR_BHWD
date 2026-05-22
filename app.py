import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'sharp_mint_dpr.db')

def load_data():
    if not os.path.exists(DB_PATH):
        return pd.DataFrame()
    conn = sqlite3.connect(DB_PATH)
    query = '''
        SELECT 
            Batch_Number,
            Process_Type,
            Start_Date,
            End_Date,
            Total_Input_Weight,
            Total_Output_Weight,
            Process_Loss_Pct,
            LM_to_MA_Conversion_Pct,
            Heptane_Loss_Pct,
            Initial_LM_Pct,
            Initial_MA_Pct,
            Final_LM_Pct,
            Final_MA_Pct,
            SOP_Compliant,
            Deviation_Notes,
            Source_File
        FROM DPR_Master
        ORDER BY Start_Date DESC
    '''
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    # Convert dates
    df['Start_Date'] = pd.to_datetime(df['Start_Date'], errors='coerce')
    df['End_Date'] = pd.to_datetime(df['End_Date'], errors='coerce')
    
    # Completely ignore data before April 2026
    df = df[df['Start_Date'] >= '2026-04-01']
    
    # Extract Plant Number from Batch Number (e.g. V-28#0526-416 -> V-28)
    df['Plant_Number'] = df['Batch_Number'].apply(lambda x: str(x).split('#')[0] if '#' in str(x) else 'Unknown')
    
    return df

st.set_page_config(page_title="Sharp Mint QC & DPR Dashboard", layout="wide")
st.title("Sharp Mint Automated DPR & Quality Control Dashboard")
st.subheader("Phase 2: Enzymatic Conversion, Solvent Recovery, and Distillation")

# Load data
df_filtered = load_data()

if df_filtered.empty:
    st.warning("No data available from April 2026 onwards.")
    st.stop()

# There should only be one main tab for now named GLR
main_tab = st.tabs(["GLR"])

with main_tab[0]:
    # The other tabs should be sub tabs under it
    sub_tabs = st.tabs(["Overview", "Daily Production Report", "GLR (Enzyme)", "SRP", "Washing"])
    
    with sub_tabs[0]:
        st.header("Phase 2 Overview")
        kpi_cols = st.columns(4)
        
        df_enzyme = df_filtered[(df_filtered['Process_Type'] == 'ENZYME_RXN') & (df_filtered['LM_to_MA_Conversion_Pct'] > 0)]
        avg_ma = df_enzyme['LM_to_MA_Conversion_Pct'].mean()
        
        df_hpt = df_filtered[(df_filtered['Process_Type'].isin(['SRP', 'WASHING'])) & (df_filtered['Heptane_Loss_Pct'] > 0)]
        avg_hpt = df_hpt['Heptane_Loss_Pct'].mean()

        df_hpt_srp = df_filtered[(df_filtered['Process_Type'] == 'SRP') & (df_filtered['Heptane_Loss_Pct'] > 0)]
        avg_hpt_srp = df_hpt_srp['Heptane_Loss_Pct'].mean()
        
        total_dmm = df_filtered[df_filtered['Process_Type'] == 'SRP']['Total_Output_Weight'].sum()
        
        kpi_cols[0].metric("Avg LM -> MA Conversion (GLR)", f"{avg_ma:.2f}%" if pd.notna(avg_ma) else "N/A")
        kpi_cols[1].metric("Avg Heptane Loss (Overall)", f"{avg_hpt:.2f}%" if pd.notna(avg_hpt) else "N/A")
        kpi_cols[2].metric("Avg Heptane Loss (SRP)", f"{avg_hpt_srp:.2f}%" if pd.notna(avg_hpt_srp) else "N/A")
        kpi_cols[3].metric("Total DMM Yield (SRP Output)", f"{total_dmm:.2f} kg")
        
        st.markdown("---")
        st.subheader("Weekly Trends")
        
        trend_cols = st.columns(2)
        with trend_cols[0]:
            st.markdown("**Heptane Loss Trend (%)**")
            heptane_filter = st.radio("Filter Heptane Loss Trend", ["Overall", "SRP", "Washing"], horizontal=True)
            if heptane_filter == "Overall":
                df_hpt_trend = df_hpt
            elif heptane_filter == "SRP":
                df_hpt_trend = df_hpt_srp
            else:
                df_hpt_trend = df_filtered[(df_filtered['Process_Type'] == 'WASHING') & (df_filtered['Heptane_Loss_Pct'] > 0)]
                
            if not df_hpt_trend.empty:
                trend_data = df_hpt_trend.set_index('Start_Date').resample('W')['Heptane_Loss_Pct'].mean().dropna().reset_index()
                fig = px.line(trend_data, x='Start_Date', y='Heptane_Loss_Pct', markers=True)
                fig.update_layout(xaxis_title='', yaxis_title='', margin=dict(l=0, r=0, t=30, b=0))
                fig.update_xaxes(tickformat='%d %b')
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No Heptane Loss data available.")
                
        with trend_cols[1]:
            st.markdown("**MA Conversion Trend (%)**")
            if not df_enzyme.empty:
                trend_data_ma = df_enzyme.set_index('Start_Date').resample('W')['LM_to_MA_Conversion_Pct'].mean().dropna().reset_index()
                fig_ma = px.line(trend_data_ma, x='Start_Date', y='LM_to_MA_Conversion_Pct', markers=True)
                fig_ma.update_layout(xaxis_title='', yaxis_title='', margin=dict(l=0, r=0, t=30, b=0))
                fig_ma.update_xaxes(tickformat='%d %b')
                st.plotly_chart(fig_ma, use_container_width=True)
            else:
                st.info("No MA Conversion data available.")

    with sub_tabs[1]:
        st.header("Daily Production Report")
        
        # Auto-sync button for WhatsApp Downloads
        import subprocess
        if st.button("Sync WhatsApp Downloads"):
            with st.spinner("Syncing new data from WhatsApp Downloads..."):
                subprocess.run(["python3", "/Users/abhi/WorkBench/Sharp_Mint/DPR/bulk_extract.py"])
                st.success("Synced successfully! Please refresh the page or it will auto-update shortly.")
        
        st.markdown("### Recent Batches (Today & Yesterday)")
        today = pd.Timestamp.now().normalize()
        yesterday = today - pd.Timedelta(days=1)
        
        # Fallback to the max date in DB if the DB hasn't been updated to actual "today" 
        # (prevents an empty screen if testing with old static data, but respects real 'today' if available)
        max_db_date = df_filtered['Start_Date'].max()
        if pd.notna(max_db_date) and max_db_date.normalize() < yesterday:
            today = max_db_date.normalize()
            yesterday = today - pd.Timedelta(days=1)
            st.info(f"Showing data relative to most recent DB entry ({today.strftime('%d %b %Y')}) because no data exists for actual today.")

        df_dpr = df_filtered[
            (df_filtered['Start_Date'].dt.normalize() >= yesterday) | 
            (df_filtered['End_Date'].dt.normalize() >= yesterday)
        ]
        
        if df_dpr.empty:
            st.info("No batches found for today or yesterday.")
        else:
            def highlight_sop(row):
                return ['background-color: rgba(220, 53, 69, 0.3);' if row['SOP_Compliant'] == 0 else '' for _ in row]

            def format_table_columns(df_tab, ptype):
                drop_cols = ['Process_Type', 'Source_File', 'Plant_Number']
                if ptype == 'ENZYME_RXN':
                    drop_cols.append('Heptane_Loss_Pct')
                    df_tab = df_tab.rename(columns={'LM_to_MA_Conversion_Pct': '🎯 LM_to_MA_Conversion_Pct'})
                elif ptype in ['SRP', 'WASHING']:
                    drop_cols.extend(['LM_to_MA_Conversion_Pct', 'Initial_LM_Pct', 'Initial_MA_Pct', 'Final_LM_Pct', 'Final_MA_Pct'])
                    df_tab = df_tab.rename(columns={'Heptane_Loss_Pct': '🎯 Heptane_Loss_Pct'})
                return df_tab.drop(columns=[c for c in drop_cols if c in df_tab.columns], errors='ignore')

            def apply_table_styles(df, ptype):
                styled = df.style.apply(highlight_sop, axis=1)
                h_props = 'background-color: rgba(255, 215, 0, 0.4); color: inherit;'
                if ptype == 'ENZYME_RXN' and '🎯 LM_to_MA_Conversion_Pct' in df.columns:
                    styled = styled.set_table_styles({'🎯 LM_to_MA_Conversion_Pct': [{'selector': 'th', 'props': h_props}]}, overwrite=False)
                elif ptype in ['SRP', 'WASHING'] and '🎯 Heptane_Loss_Pct' in df.columns:
                    styled = styled.set_table_styles({'🎯 Heptane_Loss_Pct': [{'selector': 'th', 'props': h_props}]}, overwrite=False)
                return styled

            for p_type in ['ENZYME_RXN', 'SRP', 'WASHING']:
                df_proc = df_dpr[df_dpr['Process_Type'] == p_type]
                if not df_proc.empty:
                    st.subheader(f"{p_type}")
                    formatted_df = format_table_columns(df_proc, p_type)
                    st.dataframe(apply_table_styles(formatted_df, p_type), use_container_width=True)

    def render_detailed_tab(process_type):
        df_proc = df_filtered[df_filtered['Process_Type'] == process_type]
        if df_proc.empty:
            st.info(f"No batches found for {process_type} in this period.")
            return
            
        plants = df_proc['Plant_Number'].unique()
        for plant in sorted(plants):
            st.markdown(f"### Plant: {plant}")
            plant_df = df_proc[df_proc['Plant_Number'] == plant].copy()
            
            # Format columns based on process type
            drop_cols = ['Process_Type', 'Source_File', 'Plant_Number']
            if process_type == 'ENZYME_RXN':
                drop_cols.append('Heptane_Loss_Pct')
                plant_df = plant_df.rename(columns={'LM_to_MA_Conversion_Pct': '🎯 LM_to_MA_Conversion_Pct'})
            elif process_type in ['SRP', 'WASHING']:
                drop_cols.extend(['LM_to_MA_Conversion_Pct', 'Initial_LM_Pct', 'Initial_MA_Pct', 'Final_LM_Pct', 'Final_MA_Pct'])
                plant_df = plant_df.rename(columns={'Heptane_Loss_Pct': '🎯 Heptane_Loss_Pct'})
            plant_df = plant_df.drop(columns=[c for c in drop_cols if c in plant_df.columns], errors='ignore')
            
            # Style rows with deviation in red
            def highlight_sop(row):
                return ['background-color: rgba(220, 53, 69, 0.3);' if row['SOP_Compliant'] == 0 else '' for _ in row]
                
            def apply_table_styles(df, ptype):
                styled = df.style.apply(highlight_sop, axis=1)
                h_props = 'background-color: rgba(255, 215, 0, 0.4); color: inherit;'
                if ptype == 'ENZYME_RXN' and '🎯 LM_to_MA_Conversion_Pct' in df.columns:
                    styled = styled.set_table_styles({'🎯 LM_to_MA_Conversion_Pct': [{'selector': 'th', 'props': h_props}]}, overwrite=False)
                elif ptype in ['SRP', 'WASHING'] and '🎯 Heptane_Loss_Pct' in df.columns:
                    styled = styled.set_table_styles({'🎯 Heptane_Loss_Pct': [{'selector': 'th', 'props': h_props}]}, overwrite=False)
                return styled
                
            st.dataframe(apply_table_styles(plant_df, process_type), use_container_width=True)

    with sub_tabs[2]:
        render_detailed_tab('ENZYME_RXN')
        
    with sub_tabs[3]:
        render_detailed_tab('SRP')
        
    with sub_tabs[4]:
        render_detailed_tab('WASHING')
