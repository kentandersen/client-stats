require('core-js/features/string/match-all')

const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const util = require('util');

const execAsync = util.promisify(childProcess.exec);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const [,,projectRoot] = process.argv
const cwd = path.resolve(__dirname, projectRoot)
const outputFile = path.resolve(__dirname, 'stats.json')
const startSha = '0ea6a2c97f0d69534d668a01015ed9a352addddf'

async function exec(cmd) {
    const {stdout, stderr} = await execAsync(cmd, { cwd })
    if (stderr) {
        console.error(stderr)
    }

    return stdout
}

async function getExistingStats() {
    const fileContet = await readFile(outputFile)
    const { stats } = JSON.parse(fileContet)

    return stats.map(({ date, ...rest }) => ({ date: new Date(date), ...rest }))
}

function parseTypeScriptOutput(str) {
    return [...str.matchAll(/^(\S+?)\(/gm)].map(([, filename]) => filename)
}

function calculateTsErrorCount() {
    return new Promise((resolve) => {
        const tsc = childProcess.spawn(
            './node_modules/.bin/tsc',
            ['--noEmit', '--pretty', 'false'],
            { cwd }
        );

        let output = ''
        tsc.stdout.on('data', (data) => {
            output += data.toString()
        });
        
        tsc.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });
        
        tsc.on('close', (code) => {
            const files = parseTypeScriptOutput(output)
            console.log(`Found ${files.length} typescript errors`)

            resolve(files.length)
        });
    })
}

async function calculateStats(sha) {
    console.log(`Calculating stats for sha ${sha}`)

    const date = await exec(`git show -s --format=%ci ${sha}`)
    
    console.log(`Resetting to ${sha}`)
    await exec(`git reset --hard ${sha}`)
    
    console.log(`Installing dependecies`)
    await exec(`yarn install --silent`)

    const tsErrorCount = await calculateTsErrorCount()

    return {
        sha,
        date: new Date(date.trim()),
        tsErrorCount,
    }
}


function createWriteOutput(existing) {
    let current = existing
    return (data) => {
        current = [...current, data].sort((left, right) => left.date - right.date)
        return writeFile(outputFile, JSON.stringify({ stats: current }, undefined, 4))
    }
}

async function main() {
    const stats = await getExistingStats()
    const writeOutput = createWriteOutput(stats)
    const shas = stats.map(({ sha }) => sha)

    console.log('Checking out latest typescript')

    await exec('git checkout typescript && git pull')
    const mergeLogOutput = await exec(
        `git log --format=format:%H --merges ${startSha}..HEAD`
    )
    const mergeShas = mergeLogOutput.trim().split('\n')
    console.log(`Found ${mergeShas.length} merge commits`)

    for (const sha of mergeShas) {
        if (shas.includes(sha)) {
            console.info(`${sha} already exists. Skipping...`)
            continue
        }
        
        const stat = await calculateStats(sha)
        await writeOutput(stat)
    }
}

main()
