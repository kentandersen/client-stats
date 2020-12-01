const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const util = require('util');

const execAsync = util.promisify(childProcess.exec);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const startsFile = path.resolve(__dirname, 'stats.json')
const outputFile = path.resolve(__dirname, 'index.html')

async function getStats() {
    const fileContet = await readFile(startsFile)
    const { stats } = JSON.parse(fileContet)

    return stats.map(({ date, ...rest }) => ({ date: new Date(date), ...rest }))
}

function renderHtml(stats) {
    return `
<!doctype html>
<html>

<head>
	<title>Line Chart</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@2.9.3/dist/Chart.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@1.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>

	<style>
	canvas{
		-moz-user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}
	</style>
</head>

<body>
	<div>
        <canvas id="canvas"></canvas>
        <script type="application/json" id="stats">
            ${JSON.stringify(stats)}
        </script>
	</div>
	<script>
        var stats = JSON.parse(document.getElementById('stats').textContent);
        var ctx = document.getElementById('canvas').getContext('2d');

        const labels = stats.map(({ date }) => new Date(date))
        const data = stats.map(({ tsErrorCount }) => tsErrorCount)
    


        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
					label: 'Typescript feil',
					borderColor: '#ff5959',
					fill: false,
					data,
				}]
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: 'hour',
                            tooltipFormat:'d. MMM HH:mm',
                            displayFormats: {
                                hour: 'd. MMM HH:mm'
                            }
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            suggestedMin: 0,
                        }
                    }]
                }
            }
        });
	</script>
</body>

</html>
`
}

async function main() {
    const stats = await getStats()
    const fileContet = renderHtml(stats)
    return writeFile(outputFile, fileContet)
}

main()
