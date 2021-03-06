import Config from '../config'
import fs from 'fs'
import path from 'path'
import replaceTemplate from '../utils/TemplateParser'
import { exec } from 'child_process'

export default class Container {
  config: typeof Config

  constructor () {
    this.config = Config
  }

  /**
   * Boot up the application container.
   */
  async boot (): Promise<void> {
    await this.setWorkingDirectory()
    await this.verifyPidfile()
    await this.copyPackageJson()
    await this.installDependencies()
  }

  /**
   * Make sure the configured home directory exists by recursively
   * creating it, before switching the process's working directory
   * to it.
   */
  private async setWorkingDirectory (): Promise<void> {
    const workingDir = this.config.homeDir
    fs.mkdirSync(workingDir, { recursive: true })

    process.chdir(workingDir)
  }

  /**
   * Verifies that no previous valid pidfile exists and create one
   * for this process. If a pidfile already exists, it only continues
   * if its specified pid is no longer active.
   *
   * @throws
   */
  private async verifyPidfile (): Promise<void> {
    const pidfile = path.join(this.config.homeDir, 'iotame.pid')

    try {
      // If this raises, no pidfile was present
      const pid = fs.readFileSync(pidfile, 'utf8')

      // If this raises, the pidfile didn't link to a running process
      // @see https://nodejs.org/api/process.html#process_process_kill_pid_signal
      process.kill(Number(pid), 0)

      // Now we know that the process does indeed exist
      throw new Error(`iotame is already running with pid ${pid}.`)
    } catch (err) {
      // ENOENT: Pidfile was not present
      // ESRCH: Not a running process
      if (err.code !== 'ENOENT' && err.code !== 'ESRCH') {
        throw err
      }
    }

    fs.writeFileSync(pidfile, process.pid)
    // @TODO: Make sure to clean up the pidfile when the process exits!
  }

  /**
   * Copies the package.json fixture to the home directory if it does not
   * already exist.
   */
  private async copyPackageJson (): Promise<boolean> {
    const target = path.join(this.config.homeDir, 'package.json')
    if (fs.existsSync(target)) return false

    fs.copyFileSync(path.join(__dirname, 'fixtures', 'user-package.json'), target)
    await replaceTemplate(target, {
      version: this.config.package.version as string,
    })

    return true
  }

  /**
   * Runs "npm install" in the iotame home directory, installing all its
   * specified dependencies.
   */
  private async installDependencies (): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('npm install', (error, stdout, stderr) => {
        if (error) {
          return reject(error)
        }

        resolve()
      })
    })
  }
}
