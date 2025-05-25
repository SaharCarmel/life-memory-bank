import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import { TranscriptSegment } from './types';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbInitialized: boolean = false;
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Initialize SQLite database for real-time transcript segments
   */
  public async initialize(): Promise<void> {
    if (this.dbInitialized) {
      return;
    }

    const dbPath = path.join(this.basePath, 'voicemcp.db');
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to open database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database:', dbPath);
        
        // Create tables
        this.createTables()
          .then(() => {
            this.dbInitialized = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables for real-time transcript segments
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const createTranscriptSegmentsTable = `
        CREATE TABLE IF NOT EXISTS transcript_segments (
          id TEXT PRIMARY KEY,
          chunk_id TEXT NOT NULL,
          recording_id TEXT NOT NULL,
          text TEXT NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          confidence REAL,
          language TEXT,
          is_final BOOLEAN NOT NULL DEFAULT 0,
          is_overlap BOOLEAN NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_transcript_segments_recording_id ON transcript_segments(recording_id)',
        'CREATE INDEX IF NOT EXISTS idx_transcript_segments_chunk_id ON transcript_segments(chunk_id)',
        'CREATE INDEX IF NOT EXISTS idx_transcript_segments_start_time ON transcript_segments(start_time)',
        'CREATE INDEX IF NOT EXISTS idx_transcript_segments_created_at ON transcript_segments(created_at)'
      ];

      this.db!.run(createTranscriptSegmentsTable, (err) => {
        if (err) {
          console.error('Failed to create transcript_segments table:', err);
          reject(err);
          return;
        }

        // Create indexes
        const createIndexPromises = createIndexes.map(indexSql => {
          return new Promise<void>((resolveIndex, rejectIndex) => {
            this.db!.run(indexSql, (indexErr) => {
              if (indexErr) {
                console.error('Failed to create index:', indexErr);
                rejectIndex(indexErr);
              } else {
                resolveIndex();
              }
            });
          });
        });

        Promise.all(createIndexPromises)
          .then(() => {
            console.log('Database tables and indexes created successfully');
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            console.error('Failed to close database:', err);
            reject(err);
          } else {
            console.log('Database connection closed');
            this.db = null;
            this.dbInitialized = false;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Save a real-time transcript segment to the database
   */
  public async saveTranscriptSegment(segment: TranscriptSegment): Promise<void> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, skipping transcript segment save');
      return;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO transcript_segments (
          id, chunk_id, recording_id, text, start_time, end_time,
          confidence, language, is_final, is_overlap, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
        segment.id,
        segment.chunkId,
        segment.recordingId,
        segment.text,
        segment.startTime,
        segment.endTime,
        segment.confidence || null,
        segment.language || null,
        segment.isFinal ? 1 : 0,
        segment.isOverlap ? 1 : 0,
        segment.createdAt.toISOString()
      ];

      this.db!.run(sql, params, function(err) {
        if (err) {
          console.error('Failed to save transcript segment:', err);
          reject(err);
        } else {
          console.log(`Transcript segment saved: ${segment.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * Save multiple transcript segments in a batch
   */
  public async saveTranscriptSegments(segments: TranscriptSegment[]): Promise<void> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, skipping transcript segments save');
      return;
    }

    if (segments.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION');

        const sql = `
          INSERT OR REPLACE INTO transcript_segments (
            id, chunk_id, recording_id, text, start_time, end_time,
            confidence, language, is_final, is_overlap, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const stmt = this.db!.prepare(sql);
        let errors: Error[] = [];

        segments.forEach(segment => {
          const params = [
            segment.id,
            segment.chunkId,
            segment.recordingId,
            segment.text,
            segment.startTime,
            segment.endTime,
            segment.confidence || null,
            segment.language || null,
            segment.isFinal ? 1 : 0,
            segment.isOverlap ? 1 : 0,
            segment.createdAt.toISOString()
          ];

          stmt.run(params, (err) => {
            if (err) {
              errors.push(err);
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            errors.push(err);
          }

          if (errors.length > 0) {
            this.db!.run('ROLLBACK');
            console.error('Failed to save transcript segments batch:', errors);
            reject(errors[0]);
          } else {
            this.db!.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Failed to commit transcript segments batch:', commitErr);
                reject(commitErr);
              } else {
                console.log(`Saved ${segments.length} transcript segments`);
                resolve();
              }
            });
          }
        });
      });
    });
  }

  /**
   * Get transcript segments for a recording
   */
  public async getTranscriptSegments(recordingId: string): Promise<TranscriptSegment[]> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, returning empty segments');
      return [];
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM transcript_segments 
        WHERE recording_id = ? 
        ORDER BY start_time ASC
      `;

      this.db!.all(sql, [recordingId], (err, rows: any[]) => {
        if (err) {
          console.error('Failed to get transcript segments:', err);
          reject(err);
          return;
        }

        const segments: TranscriptSegment[] = rows.map(row => ({
          id: row.id,
          chunkId: row.chunk_id,
          recordingId: row.recording_id,
          text: row.text,
          startTime: row.start_time,
          endTime: row.end_time,
          confidence: row.confidence,
          language: row.language,
          isFinal: Boolean(row.is_final),
          isOverlap: Boolean(row.is_overlap),
          createdAt: new Date(row.created_at)
        }));

        resolve(segments);
      });
    });
  }

  /**
   * Get merged text from transcript segments for a recording
   */
  public async getMergedTranscriptText(recordingId: string): Promise<string> {
    const segments = await this.getTranscriptSegments(recordingId);
    
    // Filter out overlap segments and sort by start time
    const nonOverlapSegments = segments
      .filter(s => !s.isOverlap)
      .sort((a, b) => a.startTime - b.startTime);

    return nonOverlapSegments.map(s => s.text).join(' ').trim();
  }

  /**
   * Update segment finalization status
   */
  public async finalizeTranscriptSegments(recordingId: string): Promise<void> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, skipping segment finalization');
      return;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE transcript_segments 
        SET is_final = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE recording_id = ?
      `;

      this.db!.run(sql, [recordingId], function(err) {
        if (err) {
          console.error('Failed to finalize transcript segments:', err);
          reject(err);
        } else {
          console.log(`Finalized ${this.changes} transcript segments for recording ${recordingId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Update recording ID for transcript segments
   */
  public async updateTranscriptSegmentsRecordingId(oldRecordingId: string, newRecordingId: string): Promise<void> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, skipping recording ID update');
      return;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE transcript_segments 
        SET recording_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE recording_id = ?
      `;

      this.db!.run(sql, [newRecordingId, oldRecordingId], function(err) {
        if (err) {
          console.error('Failed to update transcript segments recording ID:', err);
          reject(err);
        } else {
          console.log(`Updated ${this.changes} transcript segments from recording ID ${oldRecordingId} to ${newRecordingId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Delete transcript segments for a recording
   */
  public async deleteTranscriptSegments(recordingId: string): Promise<void> {
    if (!this.db || !this.dbInitialized) {
      console.warn('Database not initialized, skipping segment deletion');
      return;
    }

    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM transcript_segments WHERE recording_id = ?';

      this.db!.run(sql, [recordingId], function(err) {
        if (err) {
          console.error('Failed to delete transcript segments:', err);
          reject(err);
        } else {
          console.log(`Deleted ${this.changes} transcript segments for recording ${recordingId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get transcript segments statistics
   */
  public async getTranscriptSegmentsStats(): Promise<{
    totalSegments: number;
    totalRecordings: number;
    avgSegmentsPerRecording: number;
  }> {
    if (!this.db || !this.dbInitialized) {
      return { totalSegments: 0, totalRecordings: 0, avgSegmentsPerRecording: 0 };
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_segments,
          COUNT(DISTINCT recording_id) as total_recordings,
          CAST(COUNT(*) AS FLOAT) / COUNT(DISTINCT recording_id) as avg_segments_per_recording
        FROM transcript_segments
      `;

      this.db!.get(sql, [], (err, row: any) => {
        if (err) {
          console.error('Failed to get transcript segments stats:', err);
          reject(err);
          return;
        }

        resolve({
          totalSegments: row.total_segments || 0,
          totalRecordings: row.total_recordings || 0,
          avgSegmentsPerRecording: row.avg_segments_per_recording || 0
        });
      });
    });
  }
}
