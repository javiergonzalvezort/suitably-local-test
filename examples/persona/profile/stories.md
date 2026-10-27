# Stories and achievements

## The two-day report

Situation: at Brisamar Retail the weekly sales report took two analysts two days of copy-paste in Excel.
Action: I rebuilt it as dbt models on BigQuery with a Looker dashboard on top, and agreed definitions of "margin" and "stock-out" with finance first.
Result: preparation time went from 2 days to 3 hours a week, and managers stopped asking which number was right.

## Fewer surprises for managers

Situation: managers kept finding wrong numbers in dashboards before the data team did.
Action: I added dbt tests to the 25 most used models and an alert channel for failures.
Result: data incidents reported by managers fell from about 10 a month to 2.

## Forecasting parcels

Situation: depots at Tallerum Logistics planned staff with a rule of thumb.
Action: I built a Python forecast of daily parcel volumes per depot and reviewed it weekly with two depot managers.
Result: forecast error fell from 18% to 11%.
