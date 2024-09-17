// src/user/services/user.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<UserEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      jest.spyOn(repository, 'create').mockReturnValue(createUserDto as any);
      jest.spyOn(repository, 'save').mockResolvedValue({
        id: 'uuid',
        ...createUserDto,
        password: await bcrypt.hash(createUserDto.password, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.createUser(createUserDto);
      expect(result).toHaveProperty('id');
      expect(result.email).toBe(createUserDto.email);
      expect(result.name).toBe(createUserDto.name);
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('getUserById', () => {
    it('should return a user by id', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(user as any);

      const result = await service.getUserById('uuid');
      expect(result).toEqual(user);
    });

    it('should throw ProductNotFoundError if user not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        ProductNotFoundError,
      );
    });
  });
});
