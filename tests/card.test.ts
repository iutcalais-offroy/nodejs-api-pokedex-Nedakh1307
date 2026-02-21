import { describe, it, expect, vi } from 'vitest';
import { getAllCards } from '../src/controllers/cards.controller';
import { prismaMock } from './vitest.setup';

describe('Card Controller', () => {
  it('should return all cards with status 200', async () => {
    prismaMock.card.findMany.mockResolvedValue([
      { id: '1', pokedexNumber: 1, name: 'Bulbasaur' }
    ] as any);
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await getAllCards(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    prismaMock.card.findMany.mockRejectedValue(new Error('DB crash'));
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    await getAllCards(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});