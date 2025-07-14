import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitExtractor } from '../src/core/git';
import type { GitChange } from '../src/types';

// Mock React and Ink completely
vi.mock('react', () => ({
  default: {
    createElement: vi.fn(),
    FC: vi.fn(),
  },
  useState: vi.fn(() => [{}, vi.fn()]),
  useEffect: vi.fn(),
}));

// Mock ink with proper structure
vi.mock('ink', () => {
  const mockRender = vi.fn();
  return {
    render: mockRender,
    Box: vi.fn(),
    Text: vi.fn(),
    useInput: vi.fn(),
    useApp: vi.fn(() => ({ exit: vi.fn() })),
  };
});

describe('Interactive Mode Integration', () => {
  const mockChanges: GitChange[] = [
    {
      path: 'src/index.ts',
      status: 'M',
      diff: '+console.log("test");',
      additions: 10,
      deletions: 5,
    },
    {
      path: 'src/utils.ts',
      status: 'M',
      diff: '-console.log("old");',
      additions: 3,
      deletions: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('launchInteractiveMode', () => {
    it('should call render with correct changes', async () => {
      const { render } = await import('ink');
      const { launchInteractiveMode } = await import('../src/interactive');
      
      // Mock render to capture the component
      let capturedComponent: any;
      vi.mocked(render).mockImplementation((component) => {
        capturedComponent = component;
        
        // Simulate completion after a delay
        setTimeout(() => {
          if (capturedComponent?.props?.onComplete) {
            capturedComponent.props.onComplete(mockChanges, true);
          }
        }, 10);
        
        return {
          unmount: vi.fn(),
          waitUntilExit: vi.fn().mockResolvedValue(undefined),
          rerender: vi.fn(),
          clear: vi.fn(),
        };
      });

      const result = await launchInteractiveMode(mockChanges);

      expect(render).toHaveBeenCalled();
      expect(result).toEqual({
        selectedFiles: mockChanges,
        copyToClipboard: true,
      });
    });

    it('should handle cancellation', async () => {
      const { render } = await import('ink');
      const { launchInteractiveMode } = await import('../src/interactive');
      
      vi.mocked(render).mockImplementation((component) => {
        // Simulate cancellation
        setTimeout(() => {
          if (component?.props?.onCancel) {
            component.props.onCancel();
          }
        }, 10);
        
        return {
          unmount: vi.fn(),
          waitUntilExit: vi.fn().mockResolvedValue(undefined),
          rerender: vi.fn(),
          clear: vi.fn(),
        };
      });

      await expect(launchInteractiveMode(mockChanges)).rejects.toThrow('Interactive mode cancelled');
    });

    it('should handle empty file list', async () => {
      const { render } = await import('ink');
      const { launchInteractiveMode } = await import('../src/interactive');
      
      vi.mocked(render).mockImplementation((component) => {
        setTimeout(() => {
          if (component?.props?.onCancel) {
            component.props.onCancel();
          }
        }, 10);
        
        return {
          unmount: vi.fn(),
          waitUntilExit: vi.fn().mockResolvedValue(undefined),
          rerender: vi.fn(),
          clear: vi.fn(),
        };
      });

      await expect(launchInteractiveMode([])).rejects.toThrow('Interactive mode cancelled');
    });
  });

  describe('GitExtractor Integration', () => {
    it('should add modification times to changes', async () => {
      const gitExtractor = new GitExtractor();
      
      // Mock the git methods
      const mockGit = {
        raw: vi.fn().mockResolvedValue('2024-01-15 10:30:00'),
      };
      (gitExtractor as any).git = mockGit;

      const result = await gitExtractor.addFileModificationTimes(mockChanges);
      
      expect(result).toHaveLength(2);
      expect(result[0].modifyTime).toBeDefined();
      expect(result[1].modifyTime).toBeDefined();
    });
  });

  describe('Interactive Mode with Git', () => {
    it('should work with real git changes', async () => {
      const gitExtractor = new GitExtractor();
      
      // Mock git methods
      const mockGit = {
        checkIsRepo: vi.fn().mockResolvedValue(true),
        diffSummary: vi.fn().mockResolvedValue({
          files: [
            { file: 'test.ts', insertions: 5, deletions: 2, binary: false },
          ],
        }),
        diff: vi.fn().mockResolvedValue('+console.log("test");'),
        show: vi.fn().mockResolvedValue('console.log("test");'),
        raw: vi.fn().mockResolvedValue('2024-01-15 10:30:00'),
      };
      (gitExtractor as any).git = mockGit;

      const changes = await gitExtractor.getCurrentChanges();
      const changesWithTimes = await gitExtractor.addFileModificationTimes(changes);
      
      const result = await launchInteractiveMode(changesWithTimes);
      
      expect(result.selectedFiles).toBeDefined();
      expect(result.copyToClipboard).toBe(true);
    });
  });
});