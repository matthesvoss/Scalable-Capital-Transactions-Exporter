# Scalable Capital Transactions Exporter

Export your Scalable Capital transactions as a .csv (comma-separated values) file in German or English, ready to be imported into [Portfolio Performance](https://github.com/portfolio-performance/portfolio).

## Usage

1. [Install](https://www.tampermonkey.net) the Tampermonkey browser extension.
2. [Install](https://raw.githubusercontent.com/matthesvoss/Scalable-Capital-Transactions-Exporter/refs/heads/main/scalable-capital-transactions-exporter.user.js) the Scalable Capital Transactions Exporter userscript.\
   If the automatic installation does not work, copy the raw contents of [scalable-capital-transactions-exporter.user.js](scalable-capital-transactions-exporter.user.js).
   Then go to Tampermonkey &rarr; `Create a new script...` &rarr; Replace everything with the copied script &rarr; `File` &rarr; `Save`.
3. Login to Scalable Capital and navigate to your broker transactions (<https://de.scalable.capital/broker/transactions>).
4. Click on Tampermonkey and export your transactions as a CSV file in German or English using `Export Transactions CSV DE` or `Export Transactions CSV EN`. If the options are not visible, try **reloading** the page.
5. (Optionally) select a date range by entering a start and end date.
6. Save the `scalable_transactions_export_*.csv` file.
7. Import the CSV file in Portfolio Performance using `File` &rarr; `Import` &rarr; `CSV files`.\
   In German: `Datei` &rarr; `Importieren` &rarr; `CSV-Dateien`.

## Notes

- The script will update automatically if a new version becomes available. Automatic updates can be disabled in the userscript settings in Tampermonkey.
- Rate limiting can be disabled but it is recommended to leave it enabled.
