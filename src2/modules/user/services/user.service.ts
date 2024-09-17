import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { Repository, EntityManager } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { GetUserDto } from '../dto/get-user.dto';
import { UserNotFoundError } from '../../common/errors/user-not-found.error';
import { ConflictError } from '../../common/errors/conflict.error';
import { validateOrReject } from 'class-validator';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<GetUserDto> {
    this.logger.log(
      `Attempting to create user with email: ${createUserDto.email}`,
    );

    try {
      await validateOrReject(createUserDto);

      return await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          const existingUser = await transactionalEntityManager.findOne(
            UserEntity,
            { where: { email: createUserDto.email } },
          );
          if (existingUser) {
            throw new ConflictError('User with this email already exists');
          }

          const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
          const user = transactionalEntityManager.create(UserEntity, {
            ...createUserDto,
            password: hashedPassword,
          });

          await transactionalEntityManager.save(user);
          this.logger.log(`User created successfully with ID: ${user.id}`);

          return this.toDto(user);
        },
      );
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserById(id: string): Promise<GetUserDto> {
    this.logger.log(`Attempting to fetch user with ID: ${id}`);

    try {
      const cachedUser = await this.redisService.get(`user:${id}`);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      const user = await this.userRepository.findOneBy({ id });
      if (!user) {
        this.logger.warn(`User not found with ID: ${id}`);
        throw new UserNotFoundError(id);
      }

      const userDto = this.toDto(user);
      await this.redisService.set(`user:${id}`, JSON.stringify(userDto), 3600); // Cache for 1 hour
      return userDto;
    } catch (error) {
      this.logger.error(
        `Error fetching user with ID ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ... rest of the code
}
