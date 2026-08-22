import { Link, useNavigate } from "react-router"
import { MoreVerticalIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { GuyMark } from "@/components/guy-mark"
import { formatMessageTime, type Guy } from "@/lib/guys"

export function GuysTable({ guys }: { guys: Guy[] }) {
  const navigate = useNavigate()

  if (guys.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nobody here yet.{" "}
          <Link
            to="/contacts/new"
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            Make one
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guy</TableHead>
            <TableHead>Last message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guys.map((row) => {
            const status = guyStatus(row)
            const activity = row.lastMessage?.createdAt ?? row.updatedAt
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    to={`/contacts/${row.id}`}
                    className="flex items-center gap-3 hover:opacity-80"
                  >
                    <GuyMark
                      className="size-8"
                      color={row.color}
                      avatarEyes={row.avatarEyes}
                      avatarFacialHair={row.avatarFacialHair}
                      avatarHat={row.avatarHat}
                    />
                    <span className="font-heading text-sm font-semibold tracking-wide uppercase">
                      {row.name}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="block truncate text-muted-foreground">
                    {row.lastMessage?.body ?? "No messages"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMessageTime(activity)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                        />
                      }
                    >
                      <MoreVerticalIcon />
                      <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`/messages/${row.id}`)}
                      >
                        Message
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/contacts/${row.id}`)}
                      >
                        Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function guyStatus(row: Guy) {
  if (!row.lastMessage) {
    return "Quiet"
  }
  if (row.lastMessage.role === "user") {
    return "Waiting"
  }
  return "Replied"
}
