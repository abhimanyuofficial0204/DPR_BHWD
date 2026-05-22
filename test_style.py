import pandas as pd
import streamlit as st

df = pd.DataFrame({'A': [1,2], 'B': [3,4], 'C': [5,6]})

# Attempt 1: Pandas Styler
# The index of column B is 1
styles = [
    {'selector': 'th.col_heading.level0.col1', 'props': [('background-color', '#ffff99'), ('color', 'black')]}
]
st.dataframe(df.style.set_table_styles(styles, overwrite=False))
