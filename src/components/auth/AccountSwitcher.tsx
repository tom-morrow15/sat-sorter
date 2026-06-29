// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, UserIcon, Heart, Info, Copy, AlertTriangle, RotateCw, Cloud, LogIn, Sun, Moon, GraduationCap, Wallet, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useRegisterSW } from '@/hooks/useRegisterSW';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
  onBudgetPartnersClick?: () => void;
  partnersCount?: number;
  pendingInvitesCount?: number;
  // Handlers for the merged hamburger-menu content
  onOpenWallet?: () => void;
  onOpenMapleSettings?: () => void;
  onOpenPaymentMethods?: () => void;
  onCopyPreviousMonth?: () => void;
  onResetBudgetMonth?: () => void;
  onRefreshApp?: () => void;
  onUpdateApp?: () => void;
  onOpenBackup?: () => void;
  onSupportSatSorter?: () => void;
  onSupportBitcoinProjects?: () => void;
  onAbout?: () => void;
  onLearnAboutBitcoin?: () => void;
  /** Display variant: "avatar" shows the user avatar (default), "hamburger" shows a Menu icon */
  variant?: 'avatar' | 'hamburger';
  /** Only used for hamburger variant: whether an update is available */
  updateAvailable?: boolean;
  /** Additional className for the trigger button */
  triggerClassName?: string;
}

export function AccountSwitcher({
  onAddAccountClick,
  onBudgetPartnersClick,
  partnersCount = 0,
  pendingInvitesCount = 0,
  onOpenWallet,
  onOpenMapleSettings,
  onOpenPaymentMethods,
  onCopyPreviousMonth,
  onResetBudgetMonth,
  onRefreshApp,
  onUpdateApp,
  onOpenBackup,
  onSupportSatSorter,
  onSupportBitcoinProjects,
  onAbout,
  onLearnAboutBitcoin,
  variant = 'avatar',
  updateAvailable = false,
  triggerClassName,
}: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { needRefresh, updateApp } = useRegisterSW();
  const showUpdateBadge = updateAvailable || needRefresh;

  // If parent didn't provide onUpdateApp, fall back to the hook's version
  const handleUpdateApp = onUpdateApp ?? updateApp;

  if (!currentUser && variant === 'avatar') return null;

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  const hasPendingInvites = pendingInvitesCount > 0;

  // Render the trigger button based on variant
  const renderTrigger = () => {
    if (variant === 'hamburger') {
      return (
        <button className={cn('flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground', triggerClassName)}>
          <div className='relative'>
            {currentUser ? (
              <Avatar className='w-10 h-10'>
                <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
                <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
              </Avatar>
            ) : (
              <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
                <Menu className='w-5 h-5' />
              </div>
            )}
            {hasPendingInvites && (
              <span
                className='absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background'
                title={`${pendingInvitesCount} pending invite${pendingInvitesCount !== 1 ? 's' : ''}`}
              >
                {pendingInvitesCount > 9 ? '9+' : pendingInvitesCount}
              </span>
            )}
            {showUpdateBadge && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300"></span>
              </span>
            )}
          </div>
          {currentUser && (
            <div className='flex-1 text-left hidden md:block truncate'>
              <p className='font-medium text-sm truncate'>{getDisplayName(currentUser)}</p>
            </div>
          )}
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      );
    }
    // Default: avatar variant
    return (
      <button className='flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground'>
        <div className='relative'>
          <Avatar className='w-10 h-10'>
            <AvatarImage src={currentUser!.metadata.picture} alt={getDisplayName(currentUser!)} />
            <AvatarFallback>{getDisplayName(currentUser!).charAt(0)}</AvatarFallback>
          </Avatar>
          {hasPendingInvites && (
            <span
              className='absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background'
              title={`${pendingInvitesCount} pending invite${pendingInvitesCount !== 1 ? 's' : ''}`}
            >
              {pendingInvitesCount > 9 ? '9+' : pendingInvitesCount}
            </span>
          )}
        </div>
        <div className='flex-1 text-left hidden md:block truncate'>
          <p className='font-medium text-sm truncate'>{getDisplayName(currentUser!)}</p>
        </div>
        <ChevronDown className='w-4 h-4 text-muted-foreground' />
      </button>
    );
  };

  return (
    <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {renderTrigger()}
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        {/* Account switching section (only when logged in) */}
        {currentUser && (
          <>
            <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
            {otherUsers.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => setLogin(user.id)}
                className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
              >
                <Avatar className='w-8 h-8'>
                  <AvatarImage src={user.metadata.picture} alt={getDisplayName(user)} />
                  <AvatarFallback>{getDisplayName(user)?.charAt(0) || <UserIcon />}</AvatarFallback>
                </Avatar>
                <div className='flex-1 truncate'>
                  <p className='text-sm font-medium'>{getDisplayName(user)}</p>
                </div>
                {user.id === currentUser.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />

          {/* Budget Partners */}
          <DropdownMenuItem onClick={() => onBudgetPartnersClick?.()}>
            <UserIcon className="h-4 w-4 mr-2" />
            Budget Partners
            {(partnersCount > 0 || hasPendingInvites) && (
              <span className="ml-auto text-xs text-muted-foreground">
                {partnersCount > 0 && `${partnersCount}`}
                {partnersCount > 0 && hasPendingInvites && ' / '}
                {hasPendingInvites && `${pendingInvitesCount} invite${pendingInvitesCount !== 1 ? 's' : ''}`}
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => removeLogin(currentUser!.id)}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
          >
            <LogOut className='w-4 h-4' />
            <span>Log out</span>
          </DropdownMenuItem>
          </>
        )}
        {/* When NOT logged in, show login/signup options */}
        {!currentUser && (
          <>
            <DropdownMenuItem onClick={onAddAccountClick}>
              <LogIn className="h-4 w-4 mr-2" />
              Log In with Nostr
            </DropdownMenuItem>
          </>
        )}

          <DropdownMenuSeparator />

          {/* Budget Tools (merged from hamburger menu) */}
          <DropdownMenuItem onClick={() => onCopyPreviousMonth?.()}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Previous Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onResetBudgetMonth?.()} className="text-destructive focus:text-destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reset This Month
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* AI & Wallet */}
          <DropdownMenuItem onClick={() => onOpenMapleSettings?.()}>
            <span className="h-4 w-4 mr-2 text-center text-sm">🤖</span>
            Maple AI
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPaymentMethods?.()}>
            <span className="h-4 w-4 mr-2 text-center text-sm">💳</span>
            Payment Methods
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenWallet?.()}>
            <Wallet className="h-4 w-4 mr-2" />
            Lightning Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Preferences */}
          <DropdownMenuItem onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Support */}
          <DropdownMenuItem onClick={() => onSupportSatSorter?.()}>
            <Heart className="h-4 w-4 mr-2 text-pink-500" />
            Support Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSupportBitcoinProjects?.()}>
            <Heart className="h-4 w-4 mr-2" />
            Support Bitcoin Projects
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* About & Learn */}
          <DropdownMenuItem onClick={() => onAbout?.()}>
            <Info className="h-4 w-4 mr-2" />
            About Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLearnAboutBitcoin?.()}>
            <GraduationCap className="h-4 w-4 mr-2" />
            Learn About Bitcoin
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Advanced */}
          <DropdownMenuItem onClick={() => onRefreshApp?.()}>
            <RotateCw className="h-4 w-4 mr-2" />
            Refresh App (Fresh)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleUpdateApp?.()}>
            <RotateCw className="h-4 w-4 mr-2" />
            Update App
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenBackup?.()}>
            <Cloud className="h-4 w-4 mr-2" />
            Backup & Sync
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}